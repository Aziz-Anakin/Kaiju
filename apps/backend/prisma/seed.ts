import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';

config({ path: '../../.env' });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Les 5 quartiers de Tokyork avec leur accès à la mer
const QUARTERS = [
  { code: 'A', name: 'Apex', seaAccess: false },
  { code: 'E', name: 'Echo', seaAccess: true },
  { code: 'W', name: 'Warden', seaAccess: false },
  { code: 'X', name: 'Xeno', seaAccess: true },
  { code: 'Z', name: 'Zion', seaAccess: true },
];

// Chaque paire de quartiers qui se touchent d'après la matrice d'adjacence
const ADJACENCIES = [
  ['A', 'E'],
  ['A', 'W'],
  ['A', 'X'],
  ['E', 'X'],
  ['W', 'X'],
  ['W', 'Z'],
  ['X', 'Z'],
];

// Stock initial de chaque ressource dans l'ordre A, E, W, X, Z
const RESOURCES: Record<string, number[]> = {
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

async function main() {
  // On crée les quartiers ou on les laisse tels quels s'ils existent déjà
  for (const quarter of QUARTERS) {
    await prisma.quarter.upsert({
      where: { code: quarter.code },
      update: {},
      create: quarter,
    });
  }

  const quarters = await prisma.quarter.findMany();
  const idOf = (code: string) => quarters.find((q) => q.code === code)!.id;

  // On enregistre l'adjacence dans les deux sens pour simplifier les recherches
  for (const [a, b] of ADJACENCIES) {
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      await prisma.adjacency.upsert({
        where: {
          quarterId_neighborId: { quarterId: idOf(from), neighborId: idOf(to) },
        },
        update: {},
        create: { quarterId: idOf(from), neighborId: idOf(to) },
      });
    }
  }

  // On crée chaque type de ressource puis son stock dans les 5 quartiers
  for (const [name, quantities] of Object.entries(RESOURCES)) {
    const resourceType = await prisma.resourceType.upsert({
      where: { name },
      update: {},
      create: { name },
    });

    for (const [index, quarter] of QUARTERS.entries()) {
      const quarterId = idOf(quarter.code);
      await prisma.inventory.upsert({
        where: {
          quarterId_resourceTypeId: {
            quarterId,
            resourceTypeId: resourceType.id,
          },
        },
        update: {},
        create: {
          quarterId,
          resourceTypeId: resourceType.id,
          initialQuantity: quantities[index],
          quantity: quantities[index],
        },
      });
    }
  }

  // Compte ADMIN : créé seulement si ADMIN_EMAIL et ADMIN_PASSWORD sont
  // définis. Il gère ensuite tous les autres comptes depuis le site.
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const password = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: { password, role: 'ADMIN', quarterId: null },
      create: { name: 'Admin', email: ADMIN_EMAIL, password, role: 'ADMIN' },
    });
    console.log(`Compte admin disponible : ${ADMIN_EMAIL}`);
  }

  console.log('Quartiers, adjacences et ressources initialisés');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
