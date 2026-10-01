import request from 'supertest';
import { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  TestUser,
  bearer,
  createApp,
  createUser,
  deleteUsers,
  resetStock,
  resourceId,
  setLevels,
} from './helpers';

// A : dotation 12, plancher de rétention 30 % = 4, donc 8 unités cessibles.
// E : dotation 5. A et E sont voisins, E et W ne le sont pas.
const RESOURCE = 'Medical personnel';
const CODES = ['A', 'E', 'W'];

describe('Transferts et rétention (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  let qcA: TestUser;
  let qcE: TestUser;
  let qcW: TestUser;
  let cd: TestUser;
  let medicalId: number;

  const stock = async (quarter: string) =>
    (
      await request(server)
        .get(`/quarters/${quarter}/inventory/${medicalId}`)
        .set(bearer(cd))
        .expect(200)
    ).body as { quantity: number; releasable: number; retentionFloor: number };

  const ask = (user: TestUser, from: string, to: string, quantity: number) =>
    request(server)
      .post('/transfers')
      .set(bearer(user))
      .send({ fromQuarter: from, toQuarter: to, resource: RESOURCE, quantity });

  beforeAll(async () => {
    ({ app, server, prisma } = await createApp());
    qcA = await createUser(prisma, server, 'QC', 'A');
    qcE = await createUser(prisma, server, 'QC', 'E');
    qcW = await createUser(prisma, server, 'QC', 'W');
    cd = await createUser(prisma, server, 'CD');
    medicalId = await resourceId(prisma, RESOURCE);
    await setLevels(prisma, { A: 3, E: 3, W: 3, X: 1, Z: 1 });
    for (const code of CODES) await resetStock(prisma, code, RESOURCE);
  });

  afterAll(async () => {
    for (const code of CODES) await resetStock(prisma, code, RESOURCE);
    await setLevels(prisma, { A: 1, E: 1, W: 1, X: 1, Z: 1 });
    await deleteUsers(prisma, [qcA, qcE, qcW, cd]);
    await app.close();
  });

  it("calcule le plancher de rétention d'Apex (30 % de 12 = 4)", async () => {
    expect(await stock('A')).toMatchObject({
      quantity: 12,
      retentionFloor: 4,
      releasable: 8,
    });
  });

  it('refuse un transfert vers soi-même (400)', async () => {
    await ask(qcE, 'E', 'E', 1).expect(400);
  });

  it('un QC ne demande pas pour un autre quartier (403)', async () => {
    await ask(qcW, 'A', 'E', 1).expect(403);
  });

  it('refuse un transfert direct au niveau 1 (403)', async () => {
    await setLevels(prisma, { E: 1 });
    const res = await ask(qcE, 'A', 'E', 1).expect(403);
    expect(res.body.rule).toBe('permission');
    await setLevels(prisma, { E: 3 });
  });

  it('refuse un transit demandé par un QC au niveau 3 (403)', async () => {
    await ask(qcW, 'E', 'W', 1).expect(403);
  });

  it('refuse un quartier de transit pour deux voisins (422)', async () => {
    const res = await request(server)
      .post('/transfers')
      .set(bearer(qcE))
      .send({
        fromQuarter: 'A',
        toQuarter: 'E',
        resource: RESOURCE,
        quantity: 1,
        transitQuarter: 'X',
      })
      .expect(422);
    expect(res.body.rule).toBe('adjacency');
  });

  it('un transfert direct est livré après accord du donneur', async () => {
    const created = await ask(qcE, 'A', 'E', 2).expect(201);
    expect(created.body.status).toBe('PENDING');
    const id = created.body.id as number;

    // Seul le donneur ou le CD répond
    await request(server)
      .patch(`/transfers/${id}/approve`)
      .set(bearer(qcW))
      .expect(403);

    const delivered = await request(server)
      .patch(`/transfers/${id}/approve`)
      .set(bearer(qcA))
      .expect(200);
    expect(delivered.body.status).toBe('DELIVERED');

    expect((await stock('A')).quantity).toBe(10);
    expect((await stock('E')).quantity).toBe(7);

    await request(server)
      .patch(`/transfers/${id}/approve`)
      .set(bearer(qcA))
      .expect(409);
  });

  it('un transfert refusé ne bouge aucun stock', async () => {
    const created = await ask(qcE, 'A', 'E', 1).expect(201);
    const before = await stock('A');

    const rejected = await request(server)
      .patch(`/transfers/${created.body.id}/reject`)
      .set(bearer(qcA))
      .expect(200);
    expect(rejected.body.status).toBe('REJECTED');
    expect(await stock('A')).toEqual(before);
  });

  it('bloque la livraison sous le plancher de rétention (423)', async () => {
    // Il reste 10 unités dont 4 gardées : 6 cessibles, on en demande 7
    const created = await ask(qcE, 'A', 'E', 7).expect(201);

    const res = await request(server)
      .patch(`/transfers/${created.body.id}/approve`)
      .set(bearer(qcA))
      .expect(423);
    expect(res.body.rule).toBe('retention');
    expect((await stock('A')).quantity).toBe(10);
  });

  it('liste les transferts', async () => {
    const res = await request(server)
      .get('/transfers')
      .set(bearer(cd))
      .expect(200);
    expect((res.body as unknown[]).length).toBeGreaterThanOrEqual(3);
  });
});
