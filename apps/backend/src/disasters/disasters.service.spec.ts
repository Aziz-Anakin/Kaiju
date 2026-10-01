import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PermissionException } from '../common/rule.exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../websocket/events.gateway';
import { DisastersService } from './disasters.service';

describe('DisastersService', () => {
  let service: DisastersService;
  let quarters: { code: string; disasterLevel: number }[];
  let events: string[];

  // On remplace Prisma par une fausse base en mémoire pour tester sans PostgreSQL
  beforeEach(() => {
    quarters = ['A', 'E', 'W', 'X', 'Z'].map((code) => ({
      code,
      disasterLevel: 1,
    }));

    const prisma = {
      quarter: {
        findMany: () => Promise.resolve(quarters),
        findUnique: ({ where }: { where: { code: string } }) =>
          Promise.resolve(quarters.find((q) => q.code === where.code) ?? null),
        update: ({
          where,
          data,
        }: {
          where: { code: string };
          data: { disasterLevel: number };
        }) => {
          const quarter = quarters.find((q) => q.code === where.code)!;
          quarter.disasterLevel = data.disasterLevel;
          return Promise.resolve(quarter);
        },
      },
    };

    // Fausse gateway qui retient les événements envoyés pour pouvoir les vérifier
    events = [];
    const gateway = {
      broadcast: (event: string) => events.push(event),
    } as unknown as EventsGateway;

    service = new DisastersService(prisma as unknown as PrismaService, gateway);
  });

  it('renvoie le niveau de tous les quartiers', async () => {
    const result = await service.findAll();
    expect(result).toHaveLength(5);
    expect(result[0]).toEqual({ quarter: 'A', level: 1, name: 'Watch' });
  });

  it("change le niveau d'un quartier", async () => {
    const result = await service.updateLevel('X', 3);
    expect(result).toEqual({ quarter: 'X', level: 3, name: 'Emergency' });
  });

  it('prévient tous les navigateurs quand le niveau change', async () => {
    await service.updateLevel('X', 3);
    expect(events).toEqual(['disaster-level-changed']);
  });

  // Ces tests vérifient que les mauvaises valeurs renvoient bien une erreur
  it('refuse un quartier inconnu', async () => {
    await expect(service.getLevel('Q')).rejects.toThrow(NotFoundException);
  });

  it('refuse un niveau hors limites', async () => {
    await expect(service.updateLevel('A', 6)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuse le même niveau', async () => {
    await expect(service.updateLevel('A', 1)).rejects.toThrow(
      ConflictException,
    );
  });

  // Ces tests suivent la matrice de permissions en changeant le niveau avant de vérifier le rôle
  it('bloque les réservations au niveau 1', async () => {
    await expect(service.checkPermission('A', 'QC', 'reserve')).rejects.toThrow(
      PermissionException,
    );
  });

  it('autorise le QC à réserver au niveau 2', async () => {
    await service.updateLevel('A', 2);
    await expect(
      service.checkPermission('A', 'QC', 'reserve'),
    ).resolves.toBeUndefined();
  });

  it('bloque le LC pour un transfert adjacent au niveau 3', async () => {
    await service.updateLevel('E', 3);
    await expect(
      service.checkPermission('E', 'LC', 'adjacentTransfer'),
    ).rejects.toThrow(PermissionException);
  });

  it('seul le CD peut baisser la rétention au niveau 5', async () => {
    await service.updateLevel('Z', 5);
    await expect(
      service.checkPermission('Z', 'CD', 'lowerRetention'),
    ).resolves.toBeUndefined();
    await expect(
      service.checkPermission('Z', 'LC', 'lowerRetention'),
    ).rejects.toThrow(PermissionException);
  });
});
