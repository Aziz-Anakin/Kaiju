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
  setLevels,
} from './helpers';

const RESOURCE = 'Medical personnel';
const dates = {
  startDate: '2030-01-01T08:00:00.000Z',
  endDate: '2030-01-02T08:00:00.000Z',
};

describe('Réservations (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  let qcA: TestUser;
  let qcE: TestUser;
  let cd: TestUser;

  const reserve = (user: TestUser, quarter: string, quantity: number) =>
    request(server)
      .post('/reservations')
      .set(bearer(user))
      .send({
        userId: user.id,
        quarter,
        resource: RESOURCE,
        quantity,
        ...dates,
      });

  beforeAll(async () => {
    ({ app, server, prisma } = await createApp());
    qcA = await createUser(prisma, server, 'QC', 'A');
    qcE = await createUser(prisma, server, 'QC', 'E');
    cd = await createUser(prisma, server, 'CD');
    await setLevels(prisma, { A: 2, E: 2 });
  });

  afterAll(async () => {
    await setLevels(prisma, { A: 1, E: 1 });
    await deleteUsers(prisma, [qcA, qcE, cd]);
    await app.close();
  });

  it('un QC réserve dans son quartier, la réservation est en attente', async () => {
    const res = await reserve(qcA, 'A', 2).expect(201);
    expect(res.body).toMatchObject({ status: 'PENDING', quantity: 2 });
  });

  it('un QC ne réserve pas dans un autre quartier (403)', async () => {
    await reserve(qcA, 'E', 1).expect(403);
  });

  it('refuse une réservation au niveau 1 (403)', async () => {
    await setLevels(prisma, { A: 1 });
    await reserve(qcA, 'A', 1).expect(403);
    await setLevels(prisma, { A: 2 });
  });

  it('refuse une date de fin avant la date de début (400)', async () => {
    await request(server)
      .post('/reservations')
      .set(bearer(qcA))
      .send({
        userId: qcA.id,
        quarter: 'A',
        resource: RESOURCE,
        quantity: 1,
        startDate: dates.endDate,
        endDate: dates.startDate,
      })
      .expect(400);
  });

  it('refuse plus que le stock disponible (409)', async () => {
    await reserve(qcA, 'A', 999).expect(409);
  });

  it('refuse une quantité nulle (400)', async () => {
    await reserve(qcA, 'A', 0).expect(400);
  });

  it('un QC valide sa réservation, le CD l’annule', async () => {
    const created = await reserve(qcA, 'A', 1).expect(201);
    const id = created.body.id as number;

    const confirmed = await request(server)
      .patch(`/reservations/${id}/confirm`)
      .set(bearer(qcA))
      .expect(200);
    expect(confirmed.body.status).toBe('CONFIRMED');

    await request(server)
      .patch(`/reservations/${id}/confirm`)
      .set(bearer(qcA))
      .expect(409);

    const cancelled = await request(server)
      .patch(`/reservations/${id}/cancel`)
      .set(bearer(cd))
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');

    await request(server)
      .patch(`/reservations/${id}/cancel`)
      .set(bearer(cd))
      .expect(409);
  });

  it("un QC d'un autre quartier ne peut pas valider (403)", async () => {
    const created = await reserve(qcA, 'A', 1).expect(201);
    await request(server)
      .patch(`/reservations/${created.body.id}/confirm`)
      .set(bearer(qcE))
      .expect(403);
  });

  it('renvoie 404 pour une réservation inconnue', async () => {
    await request(server)
      .get('/reservations/999999999')
      .set(bearer(cd))
      .expect(404);
  });
});
