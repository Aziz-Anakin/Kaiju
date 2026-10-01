import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DisastersService } from '../disasters/disasters.service';
import { PrismaService } from '../prisma/prisma.service';
import { QuartersService } from './quarters.service';

interface FakeQuarter {
  id: number;
  code: string;
  name: string;
  seaAccess: boolean;
  disasterLevel: number;
  retentionLowered: boolean;
}

// Les 5 quartiers du sujet, tels que le seed les enregistre
const QUARTERS: FakeQuarter[] = [
  { id: 1, code: 'A', name: 'Apex', seaAccess: false, disasterLevel: 1, retentionLowered: false },
  { id: 2, code: 'E', name: 'Echo', seaAccess: true, disasterLevel: 1, retentionLowered: false },
  { id: 3, code: 'W', name: 'Warden', seaAccess: false, disasterLevel: 1, retentionLowered: false },
  { id: 4, code: 'X', name: 'Xeno', seaAccess: true, disasterLevel: 1, retentionLowered: false },
  { id: 5, code: 'Z', name: 'Zion', seaAccess: true, disasterLevel: 1, retentionLowered: false },
];

const idOf = (code: string) => QUARTERS.find((q) => q.code === code)!.id;
const quarterOf = (id: number) => QUARTERS.find((q) => q.id === id)!;

// La matrice d'adjacence du sujet, dépliée dans les deux sens comme en base
const LINKS = [
  ['A', 'E'],
  ['A', 'W'],
  ['A', 'X'],
  ['E', 'X'],
  ['W', 'X'],
  ['W', 'Z'],
  ['X', 'Z'],
].flatMap(([a, b]) => [
  { quarterId: idOf(a), neighborId: idOf(b) },
  { quarterId: idOf(b), neighborId: idOf(a) },
]);

const USERS = [
  { id: 1, role: 'CD' },
  { id: 2, role: 'QC' },
];

// Reproduit la matrice du sujet pour lowerRetention : le City Director
// seulement, et seulement sur un quartier au niveau 5.
const disasters = {
  checkPermission: (code: string, role: string, action: string) => {
    const quarter = QUARTERS.find((q) => q.code === code);
    if (
      action !== 'lowerRetention' ||
      quarter?.disasterLevel !== 5 ||
      role !== 'CD'
    ) {
      return Promise.reject(new ForbiddenException('action non autorisée'));
    }
    return Promise.resolve();
  },
};

// Fausse base de données : on teste la logique du service, pas Prisma
const prisma = {
  quarter: {
    findMany: () =>
      Promise.resolve(
        [...QUARTERS].sort((left, right) => left.code.localeCompare(right.code)),
      ),
    findUnique: (args: { where: { code: string }; include?: unknown }) => {
      const quarter = QUARTERS.find((q) => q.code === args.where.code) ?? null;

      if (!quarter || !args.include) {
        return Promise.resolve(quarter);
      }

      return Promise.resolve({
        ...quarter,
        neighbors: LINKS.filter((link) => link.quarterId === quarter.id).map(
          (link) => ({ neighbor: quarterOf(link.neighborId) }),
        ),
      });
    },
    update: (args: {
      where: { id: number };
      data: { retentionLowered: boolean };
    }) => {
      const quarter = quarterOf(args.where.id);
      quarter.retentionLowered = args.data.retentionLowered;
      return Promise.resolve(quarter);
    },
  },
  user: {
    findUnique: (args: { where: { id: number } }) =>
      Promise.resolve(USERS.find((user) => user.id === args.where.id) ?? null),
  },
  adjacency: {
    findMany: (args: { where: { quarterId: number } }) =>
      Promise.resolve(
        LINKS.filter((link) => link.quarterId === args.where.quarterId)
          .map((link) => ({ neighbor: quarterOf(link.neighborId) }))
          .sort((left, right) =>
            left.neighbor.code.localeCompare(right.neighbor.code),
          ),
      ),
    findUnique: (args: {
      where: { quarterId_neighborId: { quarterId: number; neighborId: number } };
    }) => {
      const { quarterId, neighborId } = args.where.quarterId_neighborId;
      return Promise.resolve(
        LINKS.find(
          (link) =>
            link.quarterId === quarterId && link.neighborId === neighborId,
        ) ?? null,
      );
    },
  },
};

describe('QuartersService', () => {
  let service: QuartersService;

  beforeEach(() => {
    QUARTERS.forEach((quarter) => {
      quarter.disasterLevel = 1;
      quarter.retentionLowered = false;
    });
    service = new QuartersService(
      prisma as unknown as PrismaService,
      disasters as unknown as DisastersService,
    );
  });

  it('liste les 5 quartiers triés par code', async () => {
    const quarters = await service.findAll();

    expect(quarters).toHaveLength(5);
    expect(quarters.map((quarter) => quarter.code)).toEqual([
      'A',
      'E',
      'W',
      'X',
      'Z',
    ]);
  });

  it("renvoie le détail d'un quartier avec ses voisins", async () => {
    const quarter = await service.findOne('A');

    expect(quarter.name).toBe('Apex');
    expect(quarter.seaAccess).toBe(false);
    expect(quarter.neighbors).toEqual(['E', 'W', 'X']);
  });

  it('accepte un code en minuscule', async () => {
    const quarter = await service.findOne('x');

    expect(quarter.code).toBe('X');
  });

  // Ces tests vérifient que les mauvaises valeurs renvoient bien une erreur
  it('refuse un quartier inconnu', async () => {
    await expect(service.findOne('Q')).rejects.toThrow(NotFoundException);
    await expect(service.requireByCode('Q')).rejects.toThrow(NotFoundException);
  });

  it('liste les voisins directs triés par code', async () => {
    const neighbors = await service.findNeighbors('X');

    expect(neighbors.map((neighbor) => neighbor.code)).toEqual([
      'A',
      'E',
      'W',
      'Z',
    ]);
  });

  // Ces tests suivent la matrice d'adjacence du sujet
  it('reconnaît deux quartiers adjacents', async () => {
    await expect(service.areAdjacent('A', 'E')).resolves.toBe(true);
    await expect(service.areAdjacent('E', 'A')).resolves.toBe(true);
  });

  it('refuse deux quartiers qui ne se touchent pas', async () => {
    await expect(service.areAdjacent('A', 'Z')).resolves.toBe(false);
    await expect(service.areAdjacent('E', 'W')).resolves.toBe(false);
  });

  it("ne considère pas un quartier comme son propre voisin", async () => {
    await expect(service.areAdjacent('A', 'A')).resolves.toBe(false);
  });

  it("refuse l'adjacence si un des deux quartiers n'existe pas", async () => {
    await expect(service.areAdjacent('A', 'Q')).rejects.toThrow(
      NotFoundException,
    );
  });

  // La rétention n'est abaissée que par le City Director, au niveau 5
  it('laisse le City Director abaisser la rétention au niveau 5', async () => {
    QUARTERS[0].disasterLevel = 5;

    const quarter = await service.setRetention('A', true, 1);

    expect(quarter.retentionLowered).toBe(true);
  });

  it("refuse l'abaissement à un QC", async () => {
    QUARTERS[0].disasterLevel = 5;

    await expect(service.setRetention('A', true, 2)).rejects.toThrow(
      ForbiddenException,
    );
    expect(QUARTERS[0].retentionLowered).toBe(false);
  });

  it("refuse l'abaissement si le quartier n'est pas au niveau 5", async () => {
    await expect(service.setRetention('A', true, 1)).rejects.toThrow(
      ForbiddenException,
    );
    expect(QUARTERS[0].retentionLowered).toBe(false);
  });

  it("refuse l'abaissement à un officier inconnu", async () => {
    QUARTERS[0].disasterLevel = 5;

    await expect(service.setRetention('A', true, 99)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("refuse l'abaissement sur un quartier inconnu", async () => {
    await expect(service.setRetention('Q', true, 1)).rejects.toThrow(
      NotFoundException,
    );
  });
});
