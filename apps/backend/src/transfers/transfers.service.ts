import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdjacencyException,
  PermissionException,
} from '../common/rule.exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { DisastersService } from '../disasters/disasters.service';
import { InventoryService } from '../inventory/inventory.service';
import { QuartersService } from '../quarters/quarters.service';
import { EventsGateway } from '../websocket/events.gateway';
import { CreateTransferDto } from './dto/create-transfer.dto';

// Xeno, le carrefour central de l'annexe : il touche tous les autres quartiers
const HUB = 'X';

const INCLUDE = {
  fromQuarter: true,
  toQuarter: true,
  transitQuarter: true,
  resourceType: true,
} as const;

type Party = 'giver' | 'transit' | 'director';

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly quarters: QuartersService,
    private readonly disasters: DisastersService,
    private readonly inventory: InventoryService,
  ) {}

  // Récupère tous les transferts avec leurs quartiers et leur ressource
  findAll() {
    return this.prisma.transfer.findMany({
      include: INCLUDE,
      orderBy: { id: 'asc' },
    });
  }

  // Récupère un transfert précis ou renvoie une erreur s'il n'existe pas
  async findOne(id: number) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!transfer) {
      throw new NotFoundException(`Le transfert n°${id} n'existe pas ou a été supprimé. Recharge la page pour voir la liste à jour.`);
    }
    return transfer;
  }

  // Accepte ou refuse une demande qui est encore en attente
  async answer(id: number, userId: number, status: 'APPROVED' | 'REJECTED') {
    const transfer = await this.findOne(id);
    if (transfer.status !== 'PENDING') {
      throw new ConflictException(
        `Le transfert n°${id} a déjà reçu une réponse (statut : ${transfer.status}). Recharge la page : seuls les transferts en attente peuvent être acceptés ou refusés.`,
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const party = user ? this.partyOf(user, transfer) : null;
    if (!party) {
      throw new PermissionException(
        transfer.transitQuarterId
          ? "Tu ne peux pas répondre à ce transfert : seuls le QC du quartier qui donne, celui du quartier de transit et le CD peuvent le faire. Préviens l'un d'eux."
          : "Tu ne peux pas répondre à ce transfert : seuls le QC du quartier qui donne et le CD peuvent le faire. Préviens l'un d'eux.",
      );
    }

    if (status === 'REJECTED') {
      const rejected = await this.prisma.transfer.update({
        where: { id },
        data: { status, approvedById: userId },
        include: INCLUDE,
      });
      this.events.broadcast('transfer-changed', rejected);
      return rejected;
    }

    // Un transfert direct n'a besoin que du donneur. Le City Director a
    // l'autorité totale : son accord vaut pour tous les quartiers concernés.
    if (!transfer.transitQuarterId || party === 'director') {
      await this.assertHubServedFirst(transfer);
      return this.deliver(transfer, userId);
    }

    // Un transit exige deux accords : le donneur et le quartier traversé.
    // Le premier est enregistré, la demande reste en attente du second.
    if (transfer.approvedById === null) {
      const approved = await this.prisma.transfer.update({
        where: { id },
        data: { approvedById: userId },
        include: INCLUDE,
      });
      this.events.broadcast('transfer-changed', approved);
      return approved;
    }

    const first = await this.prisma.user.findUnique({
      where: { id: transfer.approvedById },
    });
    if (first && this.partyOf(first, transfer) === party) {
      throw new ConflictException(
        `Ton quartier a déjà donné son accord pour le transfert n°${id}. Il manque maintenant celui de l'autre quartier : il n'y a rien d'autre à faire de ton côté.`,
      );
    }

    await this.assertHubServedFirst(transfer);
    return this.deliver(transfer, userId);
  }

  // Effectue le transfert en retirant le stock du quartier qui donne pour l'ajouter à celui qui reçoit
  async deliver(
    transfer: {
      id: number;
      fromQuarterId: number;
      toQuarterId: number;
      resourceTypeId: number;
      quantity: number;
      fromQuarter: { code: string };
    },
    userId: number,
  ) {
    const fromStock = await this.prisma.inventory.findUnique({
      where: {
        quarterId_resourceTypeId: {
          quarterId: transfer.fromQuarterId,
          resourceTypeId: transfer.resourceTypeId,
        },
      },
    });
    if (!fromStock || fromStock.quantity < transfer.quantity) {
      throw new ConflictException(
        `Stock insuffisant pour effectuer le transfert : il ne reste que ${fromStock?.quantity ?? 0} unité(s) dans le quartier qui donne. Refuse ce transfert et fais une nouvelle demande avec une quantité plus petite.`,
      );
    }

    // Avoir les unités ne suffit pas : un quartier doit conserver une part de
    // sa dotation initiale. La rétention tranche avant tout déplacement.
    await this.inventory.assertCanRelease(
      transfer.fromQuarter.code,
      transfer.resourceTypeId,
      transfer.quantity,
    );

    // Les trois changements sont faits ensemble pour ne jamais perdre de stock en cas d'erreur
    await this.prisma.$transaction([
      this.prisma.inventory.update({
        where: {
          quarterId_resourceTypeId: {
            quarterId: transfer.fromQuarterId,
            resourceTypeId: transfer.resourceTypeId,
          },
        },
        data: { quantity: { decrement: transfer.quantity } },
      }),
      this.prisma.inventory.update({
        where: {
          quarterId_resourceTypeId: {
            quarterId: transfer.toQuarterId,
            resourceTypeId: transfer.resourceTypeId,
          },
        },
        data: { quantity: { increment: transfer.quantity } },
      }),
      this.prisma.transfer.update({
        where: { id: transfer.id },
        data: {
          status: 'DELIVERED',
          approvedById: userId,
          deliveredAt: new Date(),
        },
      }),
    ]);

    // Prévient tout le monde que le transfert est livré et que le stock des deux quartiers a changé
    const delivered = await this.findOne(transfer.id);
    this.events.broadcast('transfer-changed', delivered);
    this.events.broadcast('stock-changed', {
      quarter: delivered.fromQuarter.code,
      resource: delivered.resourceType.name,
    });
    this.events.broadcast('stock-changed', {
      quarter: delivered.toQuarter.code,
      resource: delivered.resourceType.name,
    });
    return delivered;
  }

  // Crée une demande de transfert en attente entre deux quartiers
  async create(dto: CreateTransferDto, userId: number) {
    const from = await this.quarters.requireByCode(dto.fromQuarter);
    const to = await this.quarters.requireByCode(dto.toQuarter);

    if (from.id === to.id) {
      throw new BadRequestException(
        'Le quartier qui donne et celui qui reçoit doivent être différents. Change l\'un des deux quartiers.',
      );
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Ton compte est introuvable, il a sûrement été supprimé. Déconnecte-toi puis reconnecte-toi, ou crée un nouveau compte.");
    }

    // Le QC n'a autorité que sur un quartier : il demande pour le sien, pas
    // pour un autre. Le LC et le CD, eux, travaillent sur plusieurs quartiers.
    if (user.role === 'QC' && user.quarterId !== to.id) {
      throw new PermissionException(
        `Tu ne peux demander des ressources que pour ton propre quartier. Choisis ton quartier comme quartier qui reçoit.`,
      );
    }

    const adjacent = await this.quarters.areAdjacent(from.code, to.code);
    if (adjacent && dto.transitQuarter) {
      throw new AdjacencyException(
        `${from.code} et ${to.code} sont voisins : un transfert direct ne passe par aucun quartier. Retire le quartier de transit pour faire la demande.`,
      );
    }

    // Deux quartiers qui se touchent relèvent du transfert direct. Sinon la
    // ressource doit traverser un quartier tiers : c'est un transit, que la
    // matrice n'ouvre qu'aux niveaux de crise élevés. Le niveau qui décide est
    // celui du quartier demandeur, c'est sa crise qui justifie l'acheminement.
    await this.disasters.checkPermission(
      to.code,
      user.role,
      adjacent ? 'adjacentTransfer' : 'transit',
    );

    const resourceType = await this.prisma.resourceType.findUnique({
      where: { name: dto.resource },
    });
    if (!resourceType) {
      throw new NotFoundException(`La ressource ${dto.resource} n'existe pas. Choisis une ressource dans la liste.`);
    }

    let transitQuarterId: number | null = null;
    if (!adjacent) {
      await this.assertNoNearerSupplier(to.code, resourceType, dto.quantity);
      const transit = await this.chooseTransit(
        from.code,
        to.code,
        dto.transitQuarter,
      );
      transitQuarterId = transit.id;
    }

    // Il y a conflit si une autre demande attend déjà la même ressource du même quartier
    const others = await this.prisma.transfer.findMany({
      where: {
        fromQuarterId: from.id,
        resourceTypeId: resourceType.id,
        status: 'PENDING',
      },
    });

    const created = await this.prisma.transfer.create({
      data: {
        fromQuarterId: from.id,
        toQuarterId: to.id,
        transitQuarterId,
        resourceTypeId: resourceType.id,
        quantity: dto.quantity,
        requestedById: userId,
      },
      include: INCLUDE,
    });

    this.events.broadcast('transfer-changed', created);
    if (others.length > 0) {
      this.events.broadcast('transfer-conflict', {
        quarter: from.code,
        resource: resourceType.name,
        transferIds: [...others.map((t) => t.id), created.id],
      });
    }
    return created;
  }

  // Place de l'officier dans ce transfert : le donneur, le quartier traversé,
  // ou le City Director. Le LC organise mais ne peut forcer aucun accord.
  private partyOf(
    user: { role: string; quarterId: number | null },
    transfer: { fromQuarterId: number; transitQuarterId: number | null },
  ): Party | null {
    if (user.role === 'CD' || user.role === 'ADMIN') {
      return 'director';
    }
    if (user.role !== 'QC') {
      return null;
    }
    if (user.quarterId === transfer.fromQuarterId) {
      return 'giver';
    }
    if (
      transfer.transitQuarterId !== null &&
      user.quarterId === transfer.transitQuarterId
    ) {
      return 'transit';
    }
    return null;
  }

  // Annexe, règle de priorité n° 2 : un quartier non voisin ne peut fournir
  // que si aucun voisin du demandeur n'a le surplus nécessaire.
  private async assertNoNearerSupplier(
    to: string,
    resource: { id: number; name: string },
    quantity: number,
  ) {
    const neighbors = await this.quarters.findNeighbors(to);
    const stocks = await Promise.all(
      neighbors.map(async (neighbor) => ({
        code: neighbor.code,
        releasable: (await this.inventory.findOne(neighbor.code, resource.id))
          .releasable,
      })),
    );

    const able = stocks
      .filter((stock) => stock.releasable >= quantity)
      .map((stock) => stock.code);

    if (able.length > 0) {
      throw new AdjacencyException(
        `Priorité aux voisins : ${able.join(', ')} peut céder ${quantity} ${resource.name} à ${to}, un quartier non voisin ne peut pas être sollicité. Choisis comme quartier qui donne l'un de ses voisins qui a du stock.`,
      );
    }
  }

  // Le quartier traversé doit toucher les deux autres. Si le demandeur n'en
  // impose pas, on évite Xeno quand c'est possible : l'annexe fait passer ses
  // propres besoins avant les transits qui la traversent (règle n° 5).
  private async chooseTransit(from: string, to: string, wanted?: string) {
    const [fromNeighbors, toNeighbors] = await Promise.all([
      this.quarters.findNeighbors(from),
      this.quarters.findNeighbors(to),
    ]);
    const candidates = fromNeighbors.filter((quarter) =>
      toNeighbors.some((neighbor) => neighbor.id === quarter.id),
    );

    if (wanted) {
      const requested = await this.quarters.requireByCode(wanted);
      const chosen = candidates.find((quarter) => quarter.id === requested.id);
      if (!chosen) {
        throw new AdjacencyException(
          `${requested.code} ne touche pas à la fois ${from} et ${to} : il ne peut pas servir de quartier de transit. Choisis un quartier voisin des deux, ou laisse le champ vide pour que le système en choisisse un.`,
        );
      }
      return chosen;
    }

    const chosen =
      candidates.find((quarter) => quarter.code !== HUB) ?? candidates[0];
    if (!chosen) {
      throw new AdjacencyException(`Aucun quartier ne relie ${from} et ${to}. Choisis un autre quartier qui donne, plus proche du quartier qui reçoit.`);
    }
    return chosen;
  }

  // Annexe, règle de priorité n° 5 : un transit par Xeno passe après les
  // besoins de Xeno. Tant qu'elle attend elle-même cette ressource, il patiente.
  private async assertHubServedFirst(transfer: {
    resourceTypeId: number;
    transitQuarterId: number | null;
    transitQuarter: { code: string } | null;
  }) {
    if (
      transfer.transitQuarterId === null ||
      transfer.transitQuarter?.code !== HUB
    ) {
      return;
    }

    const hubRequests = await this.prisma.transfer.findMany({
      where: {
        toQuarterId: transfer.transitQuarterId,
        resourceTypeId: transfer.resourceTypeId,
        status: 'PENDING',
      },
    });

    if (hubRequests.length > 0) {
      throw new AdjacencyException(
        `Priorité de Xeno : elle attend elle-même cette ressource, le transit qui la traverse passera après ses propres demandes. Choisis un autre quartier de transit, ou réessaie quand Xeno aura été servie.`,
      );
    }
  }
}
