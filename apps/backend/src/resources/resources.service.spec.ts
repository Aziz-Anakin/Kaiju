import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResourcesService } from './resources.service';

interface FakeResourceType {
  id: number;
  name: string;
}

interface FakeInventory {
  resourceTypeId: number;
  quarterCode: string;
  initialQuantity: number;
  quantity: number;
}

// Les 10 ressources du sujet et leur dotation dans l'ordre A, E, W, X, Z
const SUBJECT_DATA: Record<string, number[]> = {
  'Medical personnel': [12, 5, 8, 3, 7],
  'Rescue teams': [4, 9, 3, 6, 5],
  'Transport vehicles': [6, 3, 10, 4, 7],
  'Emergency shelters': [8, 6, 4, 10, 2],
  'Food & water supplies': [5, 8, 6, 7, 9],
  'Communication equipment': [3, 7, 5, 8, 4],
  'Power generators': [7, 2, 9, 5, 6],
  'Engineering crews': [2, 6, 7, 4, 8],
  'Security units': [9, 4, 2, 6, 3],
  'Hazmat equipment': [3, 5, 4, 2, 10],
};

const QUARTER_CODES = ['A', 'E', 'W', 'X', 'Z'];

const RESOURCE_TYPES: FakeResourceType[] = Object.keys(SUBJECT_DATA).map(
  (name, index) => ({ id: index + 1, name }),
);

const INVENTORIES: FakeInventory[] = RESOURCE_TYPES.flatMap((type) =>
  QUARTER_CODES.map((quarterCode, index) => ({
    resourceTypeId: type.id,
    quarterCode,
    initialQuantity: SUBJECT_DATA[type.name][index],
    quantity: 1,
  })),
);

let lastFindManyArgs: unknown;

const prisma = {
  resourceType: {
    findMany: (args: { orderBy?: unknown }) => {
      lastFindManyArgs = args;
      return Promise.resolve(
        [...RESOURCE_TYPES].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      );
    },
    findUnique: (args: { where: { id: number } }) =>
      Promise.resolve(
        RESOURCE_TYPES.find((type) => type.id === args.where.id) ?? null,
      ),
  },
  inventory: {
    findMany: (args: { where: { resourceTypeId: number } }) =>
      Promise.resolve(
        INVENTORIES.filter(
          (inventory) => inventory.resourceTypeId === args.where.resourceTypeId,
        )
          .map((inventory) => ({
            ...inventory,
            quarter: { code: inventory.quarterCode },
          }))
          .sort((left, right) =>
            left.quarter.code.localeCompare(right.quarter.code),
          ),
      ),
  },
};

describe('ResourcesService', () => {
  let service: ResourcesService;

  beforeEach(() => {
    lastFindManyArgs = undefined;
    service = new ResourcesService(prisma as unknown as PrismaService);
  });

  it('liste les 10 types de ressources', async () => {
    const types = await service.findAll();

    expect(types).toHaveLength(10);
    expect(types.map((type) => type.name)).toContain('Medical personnel');
  });

  it('demande un tri par nom à la base', async () => {
    await service.findAll();

    expect(lastFindManyArgs).toEqual({ orderBy: { name: 'asc' } });
  });

  it("renvoie le détail d'un type avec la dotation des 5 quartiers", async () => {
    const resource = await service.findOne(1);

    expect(resource.name).toBe('Medical personnel');
    expect(resource.initialQuantities).toHaveLength(5);
  });

  it('respecte les dotations initiales du sujet', async () => {
    const resource = await service.findOne(1);

    expect(resource.initialQuantities).toEqual([
      { quarter: 'A', initialQuantity: 12 },
      { quarter: 'E', initialQuantity: 5 },
      { quarter: 'W', initialQuantity: 8 },
      { quarter: 'X', initialQuantity: 3 },
      { quarter: 'Z', initialQuantity: 7 },
    ]);
  });

  it("n'expose pas le stock courant", async () => {
    const resource = await service.findOne(1);

    for (const entry of resource.initialQuantities) {
      expect(entry).not.toHaveProperty('quantity');
    }
  });

  // Ces tests vérifient que les mauvaises valeurs renvoient bien une erreur
  it('refuse un identifiant inconnu', async () => {
    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    await expect(service.requireById(999)).rejects.toThrow(NotFoundException);
  });

  it('renvoie le type demandé via requireById', async () => {
    const type = await service.requireById(3);

    expect(type.name).toBe('Transport vehicles');
  });
});
