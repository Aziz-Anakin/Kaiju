import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RetentionException } from '../common/rule.exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { QuartersService } from '../quarters/quarters.service';
import { ResourcesService } from '../resources/resources.service';
import { EventsGateway } from '../websocket/events.gateway';
import { InventoryService } from './inventory.service';

interface Row {
  id: number;
  quarterId: number;
  resourceTypeId: number;
  initialQuantity: number;
  quantity: number;
}

const QUARTERS = [
  { id: 1, code: 'A', disasterLevel: 1, retentionLowered: false },
  { id: 2, code: 'E', disasterLevel: 1, retentionLowered: false },
];

// Le QC de A, le QC de E, un LC et le CD
const QC_A = 1;
const QC_E = 2;
const LC = 3;
const CD = 4;
const USERS = [
  { id: QC_A, role: 'QC', quarterId: 1 },
  { id: QC_E, role: 'QC', quarterId: 2 },
  { id: LC, role: 'LC', quarterId: null },
  { id: CD, role: 'CD', quarterId: null },
];

const RESOURCE_TYPES = [
  { id: 1, name: 'Medical personnel' },
  { id: 2, name: 'Rescue teams' },
];

// Dotations du sujet pour A : 12 personnels médicaux, 4 équipes de secours
const INITIAL_ROWS: Row[] = [
  { id: 10, quarterId: 1, resourceTypeId: 1, initialQuantity: 12, quantity: 12 },
  { id: 11, quarterId: 1, resourceTypeId: 2, initialQuantity: 4, quantity: 4 },
  { id: 20, quarterId: 2, resourceTypeId: 1, initialQuantity: 5, quantity: 5 },
];

let rows: Row[] = [];

const withResourceType = (row: Row) => ({
  ...row,
  resourceType: RESOURCE_TYPES.find((type) => type.id === row.resourceTypeId)!,
});

const quarters = {
  requireByCode: (code: string) => {
    const quarter = QUARTERS.find((q) => q.code === code.trim().toUpperCase());
    if (!quarter) {
      return Promise.reject(new NotFoundException('quartier inconnu'));
    }
    return Promise.resolve(quarter);
  },
};

const resources = {
  requireById: (id: number) => {
    const type = RESOURCE_TYPES.find((t) => t.id === id);
    if (!type) {
      return Promise.reject(new NotFoundException('ressource inconnue'));
    }
    return Promise.resolve(type);
  },
};

const prisma = {
  user: {
    findUnique: (args: { where: { id: number } }) =>
      Promise.resolve(USERS.find((user) => user.id === args.where.id) ?? null),
  },
  inventory: {
    findMany: (args: { where: { quarterId: number } }) =>
      Promise.resolve(
        rows
          .filter((row) => row.quarterId === args.where.quarterId)
          .map(withResourceType)
          .sort((left, right) =>
            left.resourceType.name.localeCompare(right.resourceType.name),
          ),
      ),
    findUnique: (args: {
      where: {
        quarterId_resourceTypeId: { quarterId: number; resourceTypeId: number };
      };
    }) => {
      const { quarterId, resourceTypeId } = args.where.quarterId_resourceTypeId;
      const row = rows.find(
        (candidate) =>
          candidate.quarterId === quarterId &&
          candidate.resourceTypeId === resourceTypeId,
      );
      return Promise.resolve(row ? withResourceType(row) : null);
    },
    // Reproduit le comportement de PostgreSQL : la condition fait partie de
    // l'écriture, donc rien n'est modifié si elle n'est pas remplie.
    updateMany: (args: {
      where: { id: number; quantity: { gte: number } };
      data: { quantity: { increment: number } };
    }) => {
      const row = rows.find((candidate) => candidate.id === args.where.id);
      if (!row || row.quantity < args.where.quantity.gte) {
        return Promise.resolve({ count: 0 });
      }
      row.quantity += args.data.quantity.increment;
      return Promise.resolve({ count: 1 });
    },
    update: (args: { where: { id: number }; data: { quantity: number } }) => {
      const row = rows.find((candidate) => candidate.id === args.where.id)!;
      row.quantity = args.data.quantity;
      return Promise.resolve(withResourceType(row));
    },
  },
};

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(() => {
    rows = INITIAL_ROWS.map((row) => ({ ...row }));
    QUARTERS.forEach((quarter) => {
      quarter.disasterLevel = 1;
      quarter.retentionLowered = false;
    });
    service = new InventoryService(
      prisma as unknown as PrismaService,
      quarters as unknown as QuartersService,
      resources as unknown as ResourcesService,
      { broadcast: () => {} } as unknown as EventsGateway,
    );
  });

  it("liste les stocks d'un quartier triés par nom de ressource", async () => {
    const inventory = await service.findByQuarter('A');

    expect(inventory).toHaveLength(2);
    expect(inventory.map((entry) => entry.resourceType)).toEqual([
      'Medical personnel',
      'Rescue teams',
    ]);
  });

  it('renvoie un stock précis', async () => {
    const entry = await service.findOne('A', 1);

    expect(entry).toEqual({
      resourceTypeId: 1,
      resourceType: 'Medical personnel',
      initialQuantity: 12,
      quantity: 12,
      retentionFloor: 4,
      releasable: 8,
    });
  });

  it('ajoute des unités', async () => {
    const entry = await service.adjust('A', 1, 3, QC_A);

    expect(entry.quantity).toBe(15);
  });

  it('retire des unités', async () => {
    const entry = await service.adjust('A', 1, -5, QC_A);

    expect(entry.quantity).toBe(7);
  });

  it('autorise un retrait qui tombe pile sur le plancher', async () => {
    // 4 équipes de secours, plancher de 2 : on peut en retirer 2
    const entry = await service.adjust('A', 2, -2, QC_A);

    expect(entry.quantity).toBe(2);
  });

  // La dotation initiale sert de référence au seuil de rétention : elle ne
  // doit jamais bouger, quels que soient les mouvements de stock.
  it('ne modifie jamais la dotation initiale', async () => {
    const entry = await service.adjust('A', 1, -5, QC_A);

    expect(entry.initialQuantity).toBe(12);
  });

  // Ces tests vérifient que les mauvaises valeurs renvoient bien une erreur
  it('refuse un retrait supérieur au stock', async () => {
    await expect(service.adjust('A', 1, -13, QC_A)).rejects.toThrow(
      ConflictException,
    );
  });

  it('laisse le stock intact après un retrait refusé', async () => {
    await expect(service.adjust('A', 1, -13, QC_A)).rejects.toThrow();

    const entry = await service.findOne('A', 1);
    expect(entry.quantity).toBe(12);
  });

  it('refuse un delta nul', async () => {
    await expect(service.adjust('A', 1, 0, QC_A)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuse un quartier inconnu', async () => {
    await expect(service.findOne('Q', 1)).rejects.toThrow(NotFoundException);
  });

  it('refuse une ressource inconnue', async () => {
    await expect(service.findOne('A', 999)).rejects.toThrow(NotFoundException);
  });

  it("refuse un couple quartier/ressource sans stock", async () => {
    await expect(service.findOne('E', 2)).rejects.toThrow(NotFoundException);
  });

  it('impose une quantité absolue', async () => {
    const entry = await service.setQuantity('A', 1, 5, QC_A);

    expect(entry.quantity).toBe(5);
    expect(entry.initialQuantity).toBe(12);
  });

  // La rétention : 30 % de la dotation initiale, arrondis au supérieur
  it('calcule le plancher de rétention à 30 % de la dotation', async () => {
    const entry = await service.findOne('A', 1);

    expect(entry.retentionFloor).toBe(4);
    expect(entry.releasable).toBe(8);
  });

  it('arrondit le plancher au supérieur', async () => {
    // Dotation de 4 équipes de secours : 30 % font 1,2, le quartier en garde 2
    const entry = await service.findOne('A', 2);

    expect(entry.retentionFloor).toBe(2);
  });

  it('laisse céder exactement ce qui dépasse le plancher', async () => {
    await expect(service.assertCanRelease('A', 1, 8)).resolves.toBeUndefined();
  });

  it('refuse de céder une unité de plus que le disponible', async () => {
    await expect(service.assertCanRelease('A', 1, 9)).rejects.toThrow(
      RetentionException,
    );
  });

  // Le City Director peut ramener le plancher à 15 %, mais seulement tant que
  // le quartier est au niveau 5
  it('descend le plancher à 15 % quand la rétention est abaissée au niveau 5', async () => {
    QUARTERS[0].disasterLevel = 5;
    QUARTERS[0].retentionLowered = true;

    const entry = await service.findOne('A', 1);

    expect(entry.retentionFloor).toBe(2);
    await expect(service.assertCanRelease('A', 1, 10)).resolves.toBeUndefined();
  });

  it('ignore le drapeau si le quartier est redescendu sous le niveau 5', async () => {
    QUARTERS[0].disasterLevel = 3;
    QUARTERS[0].retentionLowered = true;

    const entry = await service.findOne('A', 1);

    expect(entry.retentionFloor).toBe(4);
  });

  it('ne rend jamais un disponible négatif', async () => {
    // Stock passé sous le plancher pendant que la rétention était abaissée
    rows[0].quantity = 1;
    const entry = await service.findOne('A', 1);

    expect(entry.releasable).toBe(0);
  });

  // La rétention vaut « at all times », pas seulement pour les transferts
  it('refuse un retrait manuel qui passerait sous le plancher', async () => {
    await expect(service.adjust('A', 1, -9, QC_A)).rejects.toThrow(
      RetentionException,
    );

    const entry = await service.findOne('A', 1);
    expect(entry.quantity).toBe(12);
  });

  it('distingue le stock insuffisant de la rétention', async () => {
    await expect(service.adjust('A', 1, -13, QC_A)).rejects.toThrow(
      /Stock insuffisant/,
    );
  });

  it('refuse de fixer une quantité sous le plancher', async () => {
    await expect(service.setQuantity('A', 1, 3, QC_A)).rejects.toThrow(
      RetentionException,
    );
  });

  it('laisse toujours remonter un stock, même sous le plancher', async () => {
    rows[0].quantity = 1;

    const entry = await service.adjust('A', 1, 2, QC_A);

    expect(entry.quantity).toBe(3);
  });

  // Qui peut toucher au stock d'un quartier
  it('laisse le CD modifier le stock de n importe quel quartier', async () => {
    const entry = await service.adjust('A', 1, 1, CD);

    expect(entry.quantity).toBe(13);
  });

  it("refuse au QC d'un autre quartier de modifier le stock", async () => {
    await expect(service.adjust('A', 1, 1, QC_E)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('refuse au LC de modifier directement un stock', async () => {
    await expect(service.setQuantity('A', 1, 10, LC)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('refuse un officier inconnu', async () => {
    await expect(service.adjust('A', 1, 1, 99)).rejects.toThrow(
      NotFoundException,
    );
  });
});
