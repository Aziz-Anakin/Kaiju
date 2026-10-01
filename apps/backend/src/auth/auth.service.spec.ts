import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

let created: Record<string, unknown>[] = [];
let existingUser: Record<string, unknown> | null = null;

const users = {
  create: (data: Record<string, unknown>) => {
    created.push(data);
    return Promise.resolve({ id: 1, createdAt: new Date(), ...data });
  },
  findByEmail: (email: string) => Promise.resolve(existingUser),
};

const jwt = { signAsync: () => Promise.resolve('token') };

const SIGNUP = {
  email: 'officier@tokyork.jp',
  name: 'Officier',
  password: 'motdepasse',
  quarterId: 1,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    created = [];
    existingUser = null;
    service = new AuthService(
      users as unknown as UsersService,
      jwt as unknown as JwtService,
    );
  });

  it('crée un Quarter Coordinator', async () => {
    const user = await service.register({
      ...SIGNUP,
      role: 'QC',
    } as CreateUserDto);

    expect(user.role).toBe('QC');
  });

  // Le cœur du correctif : le rôle envoyé par le client est ignoré
  it("ignore un rôle City Director envoyé à l'inscription", async () => {
    await service.register({ ...SIGNUP, role: 'CD' } as CreateUserDto);

    expect(created[0].role).toBe('QC');
  });

  it("refuse une inscription sans quartier", async () => {
    await expect(
      service.register({
        ...SIGNUP,
        role: 'CD',
        quarterId: undefined,
      } as CreateUserDto),
    ).rejects.toThrow(BadRequestException);
    expect(created).toHaveLength(0);
  });

  it('ne stocke jamais le mot de passe en clair', async () => {
    await service.register({ ...SIGNUP, role: 'QC' } as CreateUserDto);

    expect(created[0].password).not.toBe(SIGNUP.password);
  });

  it('ne renvoie jamais le mot de passe', async () => {
    const user = await service.register({
      ...SIGNUP,
      role: 'QC',
    } as CreateUserDto);

    expect(user).not.toHaveProperty('password');
  });
});

describe('AuthService login', () => {
  let service: AuthService;

  beforeEach(() => {
    existingUser = null;
    service = new AuthService(
      users as unknown as UsersService,
      jwt as unknown as JwtService,
    );
  });

  it('connecte un utilisateur avec les bons identifiants et renvoie un token', async () => {
    existingUser = {
      id: 1,
      email: SIGNUP.email,
      password: await bcrypt.hash(SIGNUP.password, 10),
      role: 'QC',
    };

    const result = await service.login({
      email: SIGNUP.email,
      password: SIGNUP.password,
    });

    expect(result).toEqual({ access_token: 'token' });
  });

  it("refuse un email qui n'existe pas", async () => {
    existingUser = null;

    await expect(
      service.login({ email: SIGNUP.email, password: SIGNUP.password }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refuse un mauvais mot de passe', async () => {
    existingUser = {
      id: 1,
      email: SIGNUP.email,
      password: await bcrypt.hash(SIGNUP.password, 10),
      role: 'QC',
    };

    await expect(
      service.login({ email: SIGNUP.email, password: 'mauvais' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
