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

const CALM = { A: 1, E: 1, W: 1, X: 1, Z: 1 };

describe('Niveaux de crise et quartiers (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  let cd: TestUser;
  let qc: TestUser;

  beforeAll(async () => {
    ({ app, server, prisma } = await createApp());
    cd = await createUser(prisma, server, 'CD');
    qc = await createUser(prisma, server, 'QC', 'A');
    await setLevels(prisma, CALM);
  });

  afterAll(async () => {
    await setLevels(prisma, CALM);
    await deleteUsers(prisma, [cd, qc]);
    await app.close();
  });

  it('liste les 5 quartiers de Tokyork', async () => {
    const res = await request(server).get('/quarters').expect(200);
    const codes = (res.body as { code: string }[]).map((q) => q.code);
    expect(codes).toEqual(expect.arrayContaining(['A', 'E', 'W', 'X', 'Z']));
  });

  it("renvoie les voisins d'Apex", async () => {
    const res = await request(server).get('/quarters/A/neighbors').expect(200);
    const codes = (res.body as { code: string }[]).map((q) => q.code).sort();
    expect(codes).toEqual(['E', 'W', 'X']);
  });

  it('renvoie 404 pour un quartier inconnu', async () => {
    await request(server).get('/quarters/Q').expect(404);
  });

  it('renvoie le niveau de crise de tous les quartiers', async () => {
    const res = await request(server).get('/disasters').expect(200);
    expect(res.body).toHaveLength(5);
  });

  it('le City Director change le niveau de crise', async () => {
    const res = await request(server)
      .patch('/disasters/A')
      .set(bearer(cd))
      .send({ level: 3 })
      .expect(200);
    expect(res.body).toMatchObject({
      quarter: 'A',
      level: 3,
      name: 'Emergency',
    });

    const read = await request(server).get('/disasters/A').expect(200);
    expect(read.body.level).toBe(3);
  });

  it('un QC ne peut pas changer le niveau de crise (403)', async () => {
    await request(server)
      .patch('/disasters/A')
      .set(bearer(qc))
      .send({ level: 5 })
      .expect(403);
  });

  it('refuse un niveau hors de 1 à 5 (400)', async () => {
    await request(server)
      .patch('/disasters/A')
      .set(bearer(cd))
      .send({ level: 9 })
      .expect(400);
  });

  it('refuse de remettre le même niveau (409)', async () => {
    await request(server)
      .patch('/disasters/A')
      .set(bearer(cd))
      .send({ level: 3 })
      .expect(409);
  });

  it("n'abaisse la rétention qu'au niveau 5 (403 avant)", async () => {
    const refused = await request(server)
      .patch('/quarters/A/retention')
      .set(bearer(cd))
      .send({ lowered: true })
      .expect(403);
    expect(refused.body.rule).toBe('permission');

    await request(server)
      .patch('/disasters/A')
      .set(bearer(cd))
      .send({ level: 5 })
      .expect(200);

    await request(server)
      .patch('/quarters/A/retention')
      .set(bearer(cd))
      .send({ lowered: true })
      .expect(200);
  });
});
