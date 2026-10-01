import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionException } from '../common/rule.exceptions';

import { DisastersService } from '../disasters/disasters.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../websocket/events.gateway';
import { CreateReservationDto } from './dto/create-reservation.dto';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly disastersService: DisastersService,
    private readonly events: EventsGateway,
  ) {}

  // Prévient tous les navigateurs qu'une réservation a changé
  private notify<T>(reservation: T) {
    this.events.broadcast('reservation-changed', reservation);
    return reservation;
  }

  findAll() {
    return this.prisma.reservation.findMany({
      include: { quarter: true, resourceType: true },
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: { quarter: true, resourceType: true },
    });
    if (!reservation) {
      throw new NotFoundException(`La réservation n°${id} n'existe pas ou a été supprimée. Recharge la page pour voir la liste à jour.`);
    }
    return reservation;
  }

  // Calcule ce qui reste en retirant du stock les réservations encore actives
  async getAvailable(quarterId: number, resourceTypeId: number) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { quarterId_resourceTypeId: { quarterId, resourceTypeId } },
    });
    if (!inventory) {
      throw new NotFoundException(
        "Cette ressource n'existe pas dans ce quartier. Choisis une ressource que ce quartier possède.",
      );
    }

    const reservations = await this.prisma.reservation.findMany({
      where: { quarterId, resourceTypeId, status: { not: 'CANCELLED' } },
    });
    const reserved = reservations.reduce((total, r) => total + r.quantity, 0);

    return inventory.quantity - reserved;
  }

  // Vérifie l'officier, le niveau de crise, les dates et le stock avant d'enregistrer la réservation
  async create(dto: CreateReservationDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException("Ton compte est introuvable, il a sûrement été supprimé. Déconnecte-toi puis reconnecte-toi, ou crée un nouveau compte.");
    }

    const quarter = await this.prisma.quarter.findUnique({
      where: { code: dto.quarter },
    });
    if (!quarter) {
      throw new NotFoundException(`Le quartier ${dto.quarter} n'existe pas. Choisis un quartier dans la liste.`);
    }

    const resourceType = await this.prisma.resourceType.findUnique({
      where: { name: dto.resource },
    });
    if (!resourceType) {
      throw new NotFoundException(`La ressource ${dto.resource} n'existe pas. Choisis une ressource dans la liste.`);
    }

    await this.disastersService.checkPermission(
      dto.quarter,
      user.role,
      'reserve',
    );

    // Un officier ne peut réserver que dans son propre quartier
    if (user.quarterId !== quarter.id) {
      throw new PermissionException(
        `Tu ne peux réserver que dans ton propre quartier. Choisis ton quartier, ou demande au QC du quartier voulu de réserver.`,
      );
    }

    if (new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException(
        'La date de fin doit être après la date de début. Corrige les dates de ta réservation.',
      );
    }

    const available = await this.getAvailable(quarter.id, resourceType.id);
    if (dto.quantity > available) {
      throw new ConflictException(
        `Stock insuffisant pour ${dto.resource} dans le quartier ${dto.quarter} : il reste ${available} unité(s). Réserve une quantité plus petite, ou choisis une autre période.`,
      );
    }

    const created = await this.prisma.reservation.create({
      data: {
        quarterId: quarter.id,
        resourceTypeId: resourceType.id,
        userId: user.id,
        quantity: dto.quantity,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
      },
      include: { quarter: true, resourceType: true },
    });
    return this.notify(created);
  }

  // Le CD peut agir sur toutes les réservations, le QC seulement sur celles de son quartier
  async checkCanReview(quarterId: number, userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Ton compte est introuvable, il a sûrement été supprimé. Déconnecte-toi puis reconnecte-toi, ou crée un nouveau compte.");
    }
    if (user.role === 'CD' || user.role === 'ADMIN') {
      return;
    }
    if (user.role !== 'QC' || user.quarterId !== quarterId) {
      throw new PermissionException(
        'Tu ne peux pas valider ou annuler cette réservation : seuls le QC de ce quartier et le CD en ont le droit. Demande-leur de le faire.',
      );
    }
  }

  // Seule une réservation en attente peut être validée
  async confirm(id: number, userId: number) {
    const reservation = await this.findOne(id);
    await this.checkCanReview(reservation.quarterId, userId);
    if (reservation.status !== 'PENDING') {
      throw new ConflictException(
        `La réservation n°${id} ne peut pas être validée car elle est déjà ${reservation.status}. Seule une réservation en attente peut être validée : crée-en une nouvelle si besoin.`,
      );
    }
    const confirmed = await this.prisma.reservation.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: { quarter: true, resourceType: true },
    });
    return this.notify(confirmed);
  }

  // Une réservation annulée libère sa quantité dans le stock disponible
  async cancel(id: number, userId: number) {
    const reservation = await this.findOne(id);
    await this.checkCanReview(reservation.quarterId, userId);
    if (reservation.status === 'CANCELLED') {
      throw new ConflictException(`La réservation n°${id} est déjà annulée. Recharge la page pour voir son état à jour.`);
    }
    const cancelled = await this.prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { quarter: true, resourceType: true },
    });
    return this.notify(cancelled);
  }
}
