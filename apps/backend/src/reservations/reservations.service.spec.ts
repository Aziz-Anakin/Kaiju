import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PermissionException } from '../common/rule.exceptions';
import { DisastersService } from '../disasters/disasters.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../websocket/events.gateway';
import { ReservationsService } from './reservations.service';

type Reservation = {
  id: number;
  quarterId: number;
  resourceTypeId: number;
  quantity: number;
  status: string;
};

describe('ReservationsService', () => {
  let service: ReservationsService;
  let disasters: DisastersService;
  let reservations: Reservation[];

  const reservation = {
    userId: 1,
    quarter: 'A',
    resource: 'Medical personnel',
    quantity: 5,
    startDate: '2026-09-20',
    endDate: '2026-09-21',
  };

  // On remplace Prisma par une fausse base en mémoire pour tester sans PostgreSQL
  beforeEach(async () => {
    const quarters = [
      { id: 1, code: 'A', disasterLevel: 1 },
      { id: 2, code: 'E', disasterLevel: 1 },
    ];
    const users = [
      { id: 1, role: 'QC', quarterId: 1 },
      { id: 2, role: 'LC', quarterId: null },
      { id: 3, role: 'QC', quarterId: 2 },
      { id: 4, role: 'CD', quarterId: null },
    ];
    reservations = [];

    const prisma = {
      user: {
        findUnique: ({ where }: { where: { id: number } }) =>
          Promise.resolve(users.find((u) => u.id === where.id) ?? null),
      },
      quarter: {
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
      resourceType: {
        findUnique: ({ where }: { where: { name: string } }) =>
          Promise.resolve(
            where.name === 'Medical personnel'
              ? { id: 1, name: 'Medical personnel' }
              : null,
          ),
      },
      inventory: {
        findUnique: () => Promise.resolve({ quantity: 12 }),
      },
      reservation: {
        findMany: ({ where }: { where: { quarterId: number } }) =>
          Promise.resolve(
            reservations.filter(
              (r) =>
                r.quarterId === where.quarterId && r.status !== 'CANCELLED',
            ),
          ),
        findUnique: ({ where }: { where: { id: number } }) =>
          Promise.resolve(reservations.find((r) => r.id === where.id) ?? null),
        create: ({ data }: { data: Omit<Reservation, 'id' | 'status'> }) => {
          const created = {
            ...data,
            id: reservations.length + 1,
            status: 'PENDING',
          };
          reservations.push(created);
          return Promise.resolve(created);
        },
        update: ({
          where,
          data,
        }: {
          where: { id: number };
          data: { status: string };
        }) => {
          const found = reservations.find((r) => r.id === where.id)!;
          found.status = data.status;
          return Promise.resolve(found);
        },
      },
    } as unknown as PrismaService;

    disasters = new DisastersService(prisma, {
      broadcast: () => {},
    } as unknown as EventsGateway);
    service = new ReservationsService(prisma, disasters, {
      broadcast: () => {},
    } as unknown as EventsGateway);

    // On passe le quartier A au niveau 2 car les réservations sont interdites au niveau 1
    await disasters.updateLevel('A', 2);
  });

  it('crée une réservation en attente', async () => {
    const result = await service.create(reservation);
    expect(result.status).toBe('PENDING');
  });

  it('retire la quantité réservée du stock disponible', async () => {
    await service.create(reservation);
    expect(await service.getAvailable(1, 1)).toBe(7);
  });

  // Ces tests vérifient les refus liés au niveau, au rôle, au quartier et au stock
  it('refuse une réservation au niveau 1', async () => {
    await disasters.updateLevel('A', 1);
    await expect(service.create(reservation)).rejects.toThrow(
      PermissionException,
    );
  });

  it('refuse une réservation faite par un LC', async () => {
    await expect(service.create({ ...reservation, userId: 2 })).rejects.toThrow(
      PermissionException,
    );
  });

  it('refuse une réservation dans un autre quartier que le sien', async () => {
    await disasters.updateLevel('E', 2);
    await expect(
      service.create({ ...reservation, quarter: 'E' }),
    ).rejects.toThrow(PermissionException);
  });

  it('refuse une quantité plus grande que le stock', async () => {
    await expect(
      service.create({ ...reservation, quantity: 13 }),
    ).rejects.toThrow(ConflictException);
  });

  it('refuse une ressource inconnue', async () => {
    await expect(
      service.create({ ...reservation, resource: 'Tanks' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuse une date de fin avant la date de début', async () => {
    await expect(
      service.create({ ...reservation, endDate: '2026-09-19' }),
    ).rejects.toThrow(BadRequestException);
  });

  // Ces tests suivent le passage des statuts d'une réservation
  it('valide une réservation en attente', async () => {
    await service.create(reservation);
    expect((await service.confirm(1, 1)).status).toBe('CONFIRMED');
  });

  it('refuse de valider une réservation annulée', async () => {
    await service.create(reservation);
    await service.cancel(1, 1);
    await expect(service.confirm(1, 1)).rejects.toThrow(ConflictException);
  });

  it("rend le stock disponible après l'annulation", async () => {
    await service.create(reservation);
    await service.cancel(1, 1);
    expect(await service.getAvailable(1, 1)).toBe(12);
  });

  // Ces tests vérifient qui a le droit de valider ou annuler une réservation
  it("refuse qu'un QC d'un autre quartier valide la réservation", async () => {
    await service.create(reservation);
    await expect(service.confirm(1, 3)).rejects.toThrow(PermissionException);
  });

  it("refuse que le LC annule la réservation d'un QC", async () => {
    await service.create(reservation);
    await expect(service.cancel(1, 2)).rejects.toThrow(PermissionException);
  });

  it('autorise le CD à valider la réservation de n’importe quel quartier', async () => {
    await service.create(reservation);
    expect((await service.confirm(1, 4)).status).toBe('CONFIRMED');
  });
});
