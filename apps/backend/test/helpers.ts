import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export const PASSWORD = 'password1234';

export async function createApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app: INestApplication<App> = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return {
    app,
    server: app.getHttpServer() as App,
    prisma: app.get(PrismaService),
  };
}

export type TestUser = { id: number; email: string; token: string };

// Les comptes de test sont créés directement en base : l'inscription publique
// ne produit que des QC, et un seul par quartier
export async function createUser(
  prisma: PrismaService,
  server: App,
  role: 'QC' | 'LC' | 'CD' | 'ADMIN',
  quarterCode?: string,
): Promise<TestUser> {
  const quarter = quarterCode
    ? await prisma.quarter.findUniqueOrThrow({ where: { code: quarterCode } })
    : null;
  const email = `e2e-${role.toLowerCase()}${quarterCode ?? ''}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      name: `e2e ${role}`,
      password: await bcrypt.hash(PASSWORD, 4),
      role,
      quarterId: quarter?.id ?? null,
    },
  });
  const res = await request(server)
    .post('/auth/login')
    .send({ email, password: PASSWORD })
    .expect(201);
  return { id: user.id, email, token: res.body.access_token as string };
}

export const bearer = (user: TestUser) => ({
  Authorization: `Bearer ${user.token}`,
});

// Supprime les comptes de test et ce qu'ils ont créé
export async function deleteUsers(prisma: PrismaService, users: TestUser[]) {
  const ids = users.map((u) => u.id);
  await prisma.transfer.deleteMany({
    where: {
      OR: [{ requestedById: { in: ids } }, { approvedById: { in: ids } }],
    },
  });
  await prisma.reservation.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

// Remet une ressource d'un quartier à sa dotation initiale
export async function resetStock(
  prisma: PrismaService,
  quarterCode: string,
  resourceName: string,
) {
  const inventory = await prisma.inventory.findFirstOrThrow({
    where: {
      quarter: { code: quarterCode },
      resourceType: { name: resourceName },
    },
  });
  await prisma.inventory.update({
    where: { id: inventory.id },
    data: { quantity: inventory.initialQuantity },
  });
}

export async function resourceId(prisma: PrismaService, name: string) {
  return (await prisma.resourceType.findUniqueOrThrow({ where: { name } })).id;
}

export async function setLevels(
  prisma: PrismaService,
  levels: Record<string, number>,
) {
  for (const [code, disasterLevel] of Object.entries(levels)) {
    await prisma.quarter.update({
      where: { code },
      data: { disasterLevel, retentionLowered: false },
    });
  }
}
