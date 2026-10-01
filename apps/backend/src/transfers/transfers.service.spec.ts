import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AdjacencyException,
  PermissionException,
  RetentionException,
} from '../common/rule.exceptions';
import { DisastersService } from '../disasters/disasters.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuartersService } from '../quarters/quarters.service';
import { EventsGateway } from '../websocket/events.gateway';
import { TransfersService } from './transfers.service';

// Les cinq quartiers et la matrice d'adjacence de l'annexe
const QUARTERS = [
  { id: 1, code: 'A' },
  { id: 2, code: 'E' },
  { id: 3, code: 'W' },
  { id: 4, code: 'X' },
  { id: 5, code: 'Z' },
];
const LINKS = [
  ['A', 'E'],
  ['A', 'W'],
  ['A', 'X'],
  ['E', 'X'],
  ['W', 'X'],
  ['W', 'Z'],
  ['X', 'Z'],
];

const QC_E = 1;
const LC = 2;
const QC_A = 3;
const CD = 4;
const QC_W = 5;
const QC_Z = 6;
const QC_X = 7;
const USERS = [
  { id: QC_E, role: 'QC', quarterId: 2 },
  { id: LC, role: 'LC', quarterId: null },
  { id: QC_A, role: 'QC', quarterId: 1 },
  { id: CD, role: 'CD', quarterId: null },
  { id: QC_W, role: 'QC', quarterId: 3 },
  { id: QC_Z, role: 'QC', quarterId: 5 },
  { id: QC_X, role: 'QC', quarterId: 4 },
];

const MEDICAL = { id: 1, name: 'Medical personnel' };

// Demande directe d'Echo à Apex, et transit d'Apex vers Zion
const DIRECT = {
  fromQuarter: 'A',
  toQuarter: 'E',
  resource: 'Medical personnel',
  quantity: 3,
};
const TRANSIT = { ...DIRECT, toQuarter: 'Z' };

interface StoredTransfer {
  id: number;
  fromQuarterId: number;
  toQuarterId: number;
  transitQuarterId: number | null;
  resourceTypeId: number;
  quantity: number;
  status: string;
  approvedById: number | null;
  requestedById: number;
}

let transfers: StoredTransfer[] = [];
let checks: { quarter: string; role: string; action: string }[] = [];
let broadcasts: string[] = [];
let writes: unknown[][] = [];
let surplus: Record<string, number> = {};
let refusal: ForbiddenException | null = null;
let retention: RetentionException | null = null;

const byCode = (code: string) =>
  QUARTERS.find((q) => q.code === code.trim().toUpperCase());
const byId = (id: number | null) => QUARTERS.find((q) => q.id === id) ?? null;

const neighborsOf = (code: string) =>
  LINKS.filter((link) => link.includes(code))
    .map(([a, b]) => byCode(a === code ? b : a)!)
    .sort((left, right) => left.code.localeCompare(right.code));

const withRelations = (transfer: StoredTransfer) => ({
  ...transfer,
  fromQuarter: byId(transfer.fromQuarterId)!,
  toQuarter: byId(transfer.toQuarterId)!,
  transitQuarter: byId(transfer.transitQuarterId),
  resourceType: MEDICAL,
});

const quarters = {
  requireByCode: (code: string) => {
    const quarter = byCode(code);
    return quarter
      ? Promise.resolve(quarter)
      : Promise.reject(new NotFoundException('quartier inconnu'));
  },
  areAdjacent: (a: string, b: string) =>
    Promise.resolve(
      LINKS.some((link) => link.includes(a) && link.includes(b)),
    ),
  findNeighbors: (code: string) => Promise.resolve(neighborsOf(code)),
};

const disasters = {
  checkPermission: (quarter: string, role: string, action: string) => {
    checks.push({ quarter, role, action });
    return refusal ? Promise.reject(refusal) : Promise.resolve();
  },
};

// Ce que chaque quartier peut céder, au-delà de son plancher de rétention
const inventory = {
  findOne: (code: string) =>
    Promise.resolve({ releasable: surplus[code] ?? 0 }),
  assertCanRelease: () =>
    retention ? Promise.reject(retention) : Promise.resolve(),
};

const events = {
  broadcast: (name: string) => {
    broadcasts.push(name);
  },
};

const prisma = {
  user: {
    findUnique: (args: { where: { id: number } }) =>
      Promise.resolve(USERS.find((user) => user.id === args.where.id) ?? null),
  },
  resourceType: {
    findUnique: (args: { where: { name: string } }) =>
      Promise.resolve(args.where.name === MEDICAL.name ? MEDICAL : null),
  },
  inventory: {
    findUnique: () => Promise.resolve({ quantity: 10 }),
    update: () => ({}),
  },
  $transaction: (operations: unknown[]) => {
    writes.push(operations);
    return Promise.resolve([]);
  },
  transfer: {
    findMany: (args: { where: Partial<StoredTransfer> }) =>
      Promise.resolve(
        transfers.filter((transfer) =>
          Object.entries(args.where).every(
            ([key, value]) => transfer[key as keyof StoredTransfer] === value,
          ),
        ),
      ),
    findUnique: (args: { where: { id: number } }) => {
      const transfer = transfers.find((t) => t.id === args.where.id);
      return Promise.resolve(transfer ? withRelations(transfer) : null);
    },
    create: (args: { data: Omit<StoredTransfer, 'id' | 'status' | 'approvedById'> }) => {
      const transfer = {
        ...args.data,
        id: transfers.length + 100,
        status: 'PENDING',
        approvedById: null,
      };
      transfers.push(transfer);
      return Promise.resolve(withRelations(transfer));
    },
    update: (args: { where: { id: number }; data: Partial<StoredTransfer> }) => {
      const transfer = transfers.find((t) => t.id === args.where.id)!;
      Object.assign(transfer, args.data);
      return Promise.resolve(withRelations(transfer));
    },
  },
};

describe('TransfersService', () => {
  let service: TransfersService;

  beforeEach(() => {
    transfers = [];
    checks = [];
    broadcasts = [];
    writes = [];
    surplus = {};
    refusal = null;
    retention = null;
    service = new TransfersService(
      prisma as unknown as PrismaService,
      events as unknown as EventsGateway,
      quarters as unknown as QuartersService,
      disasters as unknown as DisastersService,
      inventory as unknown as InventoryService,
    );
  });

  describe('création', () => {
    it('refuse un transfert vers le même quartier', async () => {
      await expect(
        service.create({ ...DIRECT, fromQuarter: 'E' }, QC_E),
      ).rejects.toThrow(BadRequestException);
    });

    it("refuse si l'un des deux quartiers n'existe pas", async () => {
      await expect(
        service.create({ ...DIRECT, toQuarter: 'Q' }, QC_E),
      ).rejects.toThrow(NotFoundException);
    });

    it("refuse si l'officier n'existe pas", async () => {
      await expect(service.create(DIRECT, 99)).rejects.toThrow(
        NotFoundException,
      );
      expect(checks).toHaveLength(0);
    });

    it('traite deux quartiers voisins comme un transfert direct', async () => {
      const created = await service.create(DIRECT, QC_E);

      expect(checks).toEqual([
        { quarter: 'E', role: 'QC', action: 'adjacentTransfer' },
      ]);
      expect(created.transitQuarter).toBeNull();
    });

    it('traite deux quartiers non voisins comme un transit', async () => {
      await service.create(TRANSIT, LC);

      expect(checks).toEqual([{ quarter: 'Z', role: 'LC', action: 'transit' }]);
    });

    it('soumet le niveau du quartier demandeur, pas celui du donneur', async () => {
      await service.create({ ...DIRECT, fromQuarter: 'E', toQuarter: 'A' }, QC_A);

      expect(checks[0].quarter).toBe('A');
    });

    it('ne crée rien quand la matrice refuse le droit', async () => {
      refusal = new ForbiddenException('interdit à ce niveau');

      await expect(service.create(DIRECT, QC_E)).rejects.toThrow(
        ForbiddenException,
      );
      expect(transfers).toHaveLength(0);
    });

    it("refuse si la ressource n'existe pas", async () => {
      await expect(
        service.create({ ...DIRECT, resource: 'Kaiju repellent' }, QC_E),
      ).rejects.toThrow(NotFoundException);
      expect(transfers).toHaveLength(0);
    });

    it('enregistre la demande avec les identifiants résolus', async () => {
      await service.create(DIRECT, QC_E);

      expect(transfers[0]).toMatchObject({
        fromQuarterId: 1,
        toQuarterId: 2,
        transitQuarterId: null,
        resourceTypeId: 1,
        quantity: 3,
        requestedById: QC_E,
      });
      expect(broadcasts).toContain('transfer-changed');
    });

    it('accepte un code de quartier en minuscules', async () => {
      await service.create({ ...DIRECT, fromQuarter: ' a ' }, QC_E);

      expect(transfers[0].fromQuarterId).toBe(1);
    });

    it("refuse à un QC de demander pour un autre quartier que le sien", async () => {
      await expect(service.create(DIRECT, QC_A)).rejects.toThrow(
        PermissionException,
      );
      expect(transfers).toHaveLength(0);
    });

    it('laisse un LC demander pour un quartier dont il ne dépend pas', async () => {
      await service.create(DIRECT, LC);

      expect(transfers).toHaveLength(1);
    });
  });

  // Annexe : un transfert entre quartiers non voisins passe par un quartier intermédiaire
  describe('choix du quartier de transit', () => {
    it('évite Xeno quand un autre quartier relie les deux', async () => {
      // A et Z se touchent tous deux par W et par X
      const created = await service.create(TRANSIT, LC);

      expect(created.transitQuarter?.code).toBe('W');
    });

    it('passe par Xeno quand il est le seul à relier les deux', async () => {
      // E et Z n'ont que X en commun
      const created = await service.create(
        { ...TRANSIT, fromQuarter: 'E' },
        LC,
      );

      expect(created.transitQuarter?.code).toBe('X');
    });

    it('accepte un quartier de transit imposé par le demandeur', async () => {
      const created = await service.create(
        { ...TRANSIT, transitQuarter: 'x' },
        LC,
      );

      expect(created.transitQuarter?.code).toBe('X');
    });

    it('refuse un quartier de transit qui ne touche pas les deux autres', async () => {
      // E touche A, mais pas Z
      await expect(
        service.create({ ...TRANSIT, transitQuarter: 'E' }, LC),
      ).rejects.toThrow(AdjacencyException);
      expect(transfers).toHaveLength(0);
    });

    it('refuse un quartier de transit sur un transfert direct', async () => {
      await expect(
        service.create({ ...DIRECT, transitQuarter: 'X' }, LC),
      ).rejects.toThrow(AdjacencyException);
    });
  });

  // Annexe, règle de priorité n° 2
  describe('priorité aux voisins', () => {
    it('refuse un transit quand un voisin du demandeur a le surplus', async () => {
      // W touche Z et peut céder 5 unités : pas besoin d'aller chercher chez A
      surplus = { W: 5 };

      const refusal = service.create(TRANSIT, LC);

      await expect(refusal).rejects.toThrow(AdjacencyException);
      await expect(refusal).rejects.toThrow(/Priorité aux voisins : W/);
      expect(transfers).toHaveLength(0);
    });

    it("autorise le transit quand aucun voisin n'a assez", async () => {
      surplus = { W: 2, X: 2 };

      await service.create(TRANSIT, LC);

      expect(transfers).toHaveLength(1);
    });

    it("n'applique pas la règle à un transfert direct", async () => {
      surplus = { X: 10 };

      await service.create(DIRECT, QC_E);

      expect(transfers).toHaveLength(1);
    });
  });

  describe('réponse à un transfert direct', () => {
    it("livre dès l'accord du QC qui donne", async () => {
      const created = await service.create(DIRECT, QC_E);

      const answered = await service.answer(created.id, QC_A, 'APPROVED');

      expect(answered.status).toBe('DELIVERED');
      expect(writes).toHaveLength(1);
    });

    it('refuse la réponse du QC qui reçoit', async () => {
      const created = await service.create(DIRECT, QC_E);

      await expect(
        service.answer(created.id, QC_E, 'APPROVED'),
      ).rejects.toThrow(PermissionException);
    });

    it('ne déplace aucun stock quand la rétention refuse', async () => {
      const created = await service.create(DIRECT, QC_E);
      retention = new RetentionException('rétention');

      await expect(
        service.answer(created.id, QC_A, 'APPROVED'),
      ).rejects.toThrow(RetentionException);
      expect(writes).toHaveLength(0);
    });
  });

  // Annexe : le transit exige l'accord du quartier traversé, et le LC ne peut
  // forcer aucun transfert sans l'accord d'un QC
  describe('réponse à un transit', () => {
    let id: number;

    beforeEach(async () => {
      // Transit d'Apex vers Zion par Warden
      id = (await service.create(TRANSIT, LC)).id;
    });

    it("ne livre pas sur le seul accord du donneur", async () => {
      const answered = await service.answer(id, QC_A, 'APPROVED');

      expect(answered.status).toBe('PENDING');
      expect(answered.approvedById).toBe(QC_A);
      expect(writes).toHaveLength(0);
    });

    it('livre quand le donneur puis le quartier traversé ont accepté', async () => {
      await service.answer(id, QC_A, 'APPROVED');
      const answered = await service.answer(id, QC_W, 'APPROVED');

      expect(answered.status).toBe('DELIVERED');
      expect(writes).toHaveLength(1);
    });

    it("livre aussi quand le quartier traversé accepte en premier", async () => {
      await service.answer(id, QC_W, 'APPROVED');
      const answered = await service.answer(id, QC_A, 'APPROVED');

      expect(answered.status).toBe('DELIVERED');
    });

    it('refuse un deuxième accord du même quartier', async () => {
      await service.answer(id, QC_A, 'APPROVED');

      await expect(service.answer(id, QC_A, 'APPROVED')).rejects.toThrow(
        ConflictException,
      );
      expect(writes).toHaveLength(0);
    });

    it("laisse le City Director livrer d'un seul accord", async () => {
      const answered = await service.answer(id, CD, 'APPROVED');

      expect(answered.status).toBe('DELIVERED');
    });

    it("refuse l'accord du LC, qui ne peut rien forcer", async () => {
      await expect(service.answer(id, LC, 'APPROVED')).rejects.toThrow(
        PermissionException,
      );
    });

    it("refuse l'accord d'un QC étranger au transfert", async () => {
      await expect(service.answer(id, QC_E, 'APPROVED')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('laisse le quartier traversé refuser le transit', async () => {
      const answered = await service.answer(id, QC_W, 'REJECTED');

      expect(answered.status).toBe('REJECTED');
      expect(writes).toHaveLength(0);
    });
  });

  // Annexe, règle de priorité n° 5
  describe('priorité de Xeno', () => {
    let id: number;

    beforeEach(async () => {
      // Transit d'Echo vers Zion, qui ne peut passer que par Xeno
      id = (await service.create({ ...TRANSIT, fromQuarter: 'E' }, LC)).id;
    });

    it('fait patienter un transit tant que Xeno attend la même ressource', async () => {
      // Xeno a demandé elle-même du personnel médical à Apex
      await service.create({ ...DIRECT, toQuarter: 'X' }, QC_X);
      await service.answer(id, QC_E, 'APPROVED');

      const refusal = service.answer(id, QC_X, 'APPROVED');

      await expect(refusal).rejects.toThrow(AdjacencyException);
      await expect(refusal).rejects.toThrow(/Priorité de Xeno/);
      expect(writes).toHaveLength(0);
    });

    it("livre le transit quand Xeno n'attend rien", async () => {
      await service.answer(id, QC_E, 'APPROVED');
      const answered = await service.answer(id, QC_X, 'APPROVED');

      expect(answered.status).toBe('DELIVERED');
    });

    it('ne retient pas un transit qui passe par un autre quartier', async () => {
      await service.create({ ...DIRECT, toQuarter: 'X' }, QC_X);
      const viaWarden = (await service.create(TRANSIT, LC)).id;

      await service.answer(viaWarden, QC_A, 'APPROVED');
      const answered = await service.answer(viaWarden, QC_W, 'APPROVED');

      expect(answered.status).toBe('DELIVERED');
    });
  });
});
