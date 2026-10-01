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
  setLevels,
} from './helpers';

describe('Rôle admin et gestion des comptes (e2e)', () => {
  let app: INestApplication<App>;
  let server: App;
  let prisma: PrismaService;
  let admin: TestUser;
  let cd: TestUser;
  const created: TestUser[] = [];
  const emails: string[] = [];

  const newEmail = () => {
    const email = `e2e-new-${Date.now()}-${emails.length}@example.com`;
    emails.push(email);
    return email;
  };

  beforeAll(async () => {
    ({ app, server, prisma } = await createApp());
    admin = await createUser(prisma, server, 'ADMIN');
    cd = await createUser(prisma, server, 'CD');
    await setLevels(prisma, { A: 1 });
  });

  afterAll(async () => {
    await setLevels(prisma, { A: 1 });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await deleteUsers(prisma, [admin, cd, ...created]);
    await app.close();
  });

  it("l'admin liste les comptes", async () => {
    const res = await request(server)
      .get('/users')
      .set(bearer(admin))
      .expect(200);
    expect(res.body.some((u: { id: number }) => u.id === admin.id)).toBe(true);
    expect(res.body[0].password).toBeUndefined();
  });

  it('un CD ne peut pas gérer les comptes (403)', async () => {
    await request(server).get('/users').set(bearer(cd)).expect(403);
    await request(server)
      .post('/users')
      .set(bearer(cd))
      .send({
        email: newEmail(),
        password: PASSWORD,
        name: 'Refusé',
        role: 'LC',
      })
      .expect(403);
  });

  it("l'admin crée un LC qui peut se connecter, sans exposer le mot de passe", async () => {
    const email = newEmail();
    const res = await request(server)
      .post('/users')
      .set(bearer(admin))
      .send({ email, password: PASSWORD, name: 'LC créé', role: 'LC' })
      .expect(201);
    expect(res.body.role).toBe('LC');
    expect(res.body.password).toBeUndefined();

    await request(server)
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(201);
  });

  it("l'admin change le rôle d'un compte puis le supprime", async () => {
    const email = newEmail();
    const made = await request(server)
      .post('/users')
      .set(bearer(admin))
      .send({ email, password: PASSWORD, name: 'À promouvoir', role: 'LC' })
      .expect(201);
    const id = made.body.id as number;

    const promoted = await request(server)
      .patch(`/users/${id}`)
      .set(bearer(admin))
      .send({ role: 'CD' })
      .expect(200);
    expect(promoted.body.role).toBe('CD');

    await request(server)
      .delete(`/users/${id}`)
      .set(bearer(admin))
      .expect(200);
    await request(server).get(`/users/${id}`).set(bearer(admin)).expect(404);
  });

  it('un QC doit avoir un quartier (400)', async () => {
    await request(server)
      .post('/users')
      .set(bearer(admin))
      .send({
        email: newEmail(),
        password: PASSWORD,
        name: 'QC sans quartier',
        role: 'QC',
      })
      .expect(400);
  });

  it("l'admin ne peut pas modifier ni supprimer son propre compte (400)", async () => {
    await request(server)
      .patch(`/users/${admin.id}`)
      .set(bearer(admin))
      .send({ role: 'CD' })
      .expect(400);
    await request(server)
      .delete(`/users/${admin.id}`)
      .set(bearer(admin))
      .expect(400);
  });

  it("l'admin a les droits du CD sur les niveaux de crise", async () => {
    const res = await request(server)
      .patch('/disasters/A')
      .set(bearer(admin))
      .send({ level: 2 })
      .expect(200);
    expect(res.body.level).toBe(2);
  });
});
