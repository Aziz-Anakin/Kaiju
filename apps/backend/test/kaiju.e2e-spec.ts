import request from 'supertest';
import { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  PASSWORD,
  TestUser,
  bearer,
  createApp,
  createUser,
  deleteUsers,
} from './helpers';

// Tourne sur la vraie base (Postgres + seed), comme en dev.
describe('Authentification (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  const users: TestUser[] = [];
  const quarterCode = `T${Date.now() % 100000}`;

  beforeAll(async () => {
    ({ app, server, prisma } = await createApp());
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { quarter: { code: quarterCode } } });
    await prisma.quarter.deleteMany({ where: { code: quarterCode } });
    await deleteUsers(prisma, users);
    await app.close();
  });

  it('connecte un compte existant et renvoie un token', async () => {
    const user = await createUser(prisma, server, 'CD');
    users.push(user);
    expect(typeof user.token).toBe('string');
  });

  it('refuse un mauvais mot de passe (401)', async () => {
    const user = await createUser(prisma, server, 'LC');
    users.push(user);
    await request(server)
      .post('/auth/login')
      .send({ email: user.email, password: 'mauvais-mot-de-passe' })
      .expect(401);
  });

  it('refuse un email inconnu (401)', async () => {
    await request(server)
      .post('/auth/login')
      .send({ email: 'inconnu@example.com', password: PASSWORD })
      .expect(401);
  });

  it('refuse un email invalide (400)', async () => {
    await request(server)
      .post('/auth/login')
      .send({ email: 'pas-un-email', password: PASSWORD })
      .expect(400);
  });

  it("l'inscription force le rôle QC même si CD est demandé", async () => {
    const quarter = await prisma.quarter.create({
      data: { code: quarterCode, name: 'E2E', seaAccess: false },
    });

    const res = await request(server)
      .post('/auth/register')
      .send({
        email: `e2e-register-${Date.now()}@example.com`,
        password: PASSWORD,
        name: 'Inscrit',
        role: 'CD',
        quarterId: quarter.id,
      })
      .expect(201);

    expect(res.body.role).toBe('QC');
    expect(res.body.password).toBeUndefined();
  });

  it("l'inscription refuse un mot de passe trop court (400)", async () => {
    await request(server)
      .post('/auth/register')
      .send({
        email: 'court@example.com',
        password: 'abc',
        name: 'Court',
        role: 'QC',
        quarterId: 1,
      })
      .expect(400);
  });

  it('protège les routes sans token (401)', async () => {
    await request(server).get('/resources').expect(401);
    await request(server).get('/reservations').expect(401);
    await request(server).get('/transfers').expect(401);
    await request(server).patch('/disasters/A').send({ level: 2 }).expect(401);
  });

  it("réserve la liste des utilisateurs à l'admin (403)", async () => {
    const lc = await createUser(prisma, server, 'LC');
    users.push(lc);
    await request(server).get('/users').set(bearer(lc)).expect(403);
  });
});
