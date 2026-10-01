import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PermissionException,
  RetentionException,
} from '../common/rule.exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { QuartersService } from '../quarters/quarters.service';
import { ResourcesService } from '../resources/resources.service';
import { EventsGateway } from '../websocket/events.gateway';
import { retentionFloor, type RetentionState } from './retention';

interface InventoryRow {
  initialQuantity: number;
  quantity: number;
  resourceType: { id: number; name: string };
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quarters: QuartersService,
    private readonly resources: ResourcesService,
    private readonly events: EventsGateway,
  ) {}

  // Prévient tous les navigateurs que le stock d'un quartier a changé
  private async notify(code: string, resourceTypeId: number) {
    const view = await this.findOne(code, resourceTypeId);
    this.events.broadcast('stock-changed', {
      quarter: code.trim().toUpperCase(),
      resource: view.resourceType,
    });
    return view;
  }

  async findByQuarter(code: string) {
    const quarter = await this.quarters.requireByCode(code);

    const inventories = await this.prisma.inventory.findMany({
      where: { quarterId: quarter.id },
      include: { resourceType: true },
      orderBy: { resourceType: { name: 'asc' } },
    });

    return inventories.map((inventory) => this.toView(inventory, quarter));
  }

  async findOne(code: string, resourceTypeId: number) {
    const [quarter, inventory] = await Promise.all([
      this.quarters.requireByCode(code),
      this.requireInventory(code, resourceTypeId),
    ]);

    return this.toView(inventory, quarter);
  }

  // Refuse de laisser partir des unités que le quartier doit garder.
  // Appelé par les transferts avant de déplacer du stock.
  async assertCanRelease(
    code: string,
    resourceTypeId: number,
    quantity: number,
  ) {
    const view = await this.findOne(code, resourceTypeId);

    if (quantity > view.releasable) {
      throw new RetentionException(
        `Rétention : le quartier ${code.trim().toUpperCase()} doit conserver ${view.retentionFloor} unité(s) de ${view.resourceType} sur une dotation de ${view.initialQuantity}, il ne peut en céder que ${view.releasable}. Demande une quantité de ${view.releasable} au maximum, ou choisis un autre quartier.`,
      );
    }
  }

  // Ajoute (delta positif) ou retire (delta négatif) des unités.
  async adjust(
    code: string,
    resourceTypeId: number,
    delta: number,
    userId: number,
  ) {
    if (delta === 0) {
      throw new BadRequestException('La variation de stock ne peut pas être 0. Indique un nombre positif pour ajouter des unités, ou négatif pour en retirer.');
    }

    const [quarter, inventory] = await Promise.all([
      this.quarters.requireByCode(code),
      this.requireInventory(code, resourceTypeId),
    ]);
    await this.assertCanManage(quarter, userId);

    // La rétention vaut « at all times » : un retrait ne peut jamais faire
    // passer le stock sous le plancher. La condition part dans la même requête
    // que l'écriture, deux retraits simultanés ne peuvent donc pas la franchir.
    const floor = retentionFloor(inventory.initialQuantity, quarter);
    const updated = await this.prisma.inventory.updateMany({
      where: {
        id: inventory.id,
        quantity: { gte: delta < 0 ? floor - delta : 0 },
      },
      data: { quantity: { increment: delta } },
    });

    if (updated.count === 0) {
      throw this.refusal(
        quarter.code,
        inventory,
        inventory.quantity + delta,
        floor,
      );
    }

    return this.notify(code, resourceTypeId);
  }

  async setQuantity(
    code: string,
    resourceTypeId: number,
    quantity: number,
    userId: number,
  ) {
    const [quarter, inventory] = await Promise.all([
      this.quarters.requireByCode(code),
      this.requireInventory(code, resourceTypeId),
    ]);
    await this.assertCanManage(quarter, userId);

    // Remonter le stock est toujours permis ; le baisser, jamais sous le plancher
    const floor = retentionFloor(inventory.initialQuantity, quarter);
    if (quantity < inventory.quantity && quantity < floor) {
      throw this.refusal(quarter.code, inventory, quantity, floor);
    }

    await this.prisma.inventory.update({
      where: { id: inventory.id },
      data: { quantity },
    });

    return this.notify(code, resourceTypeId);
  }

  // Le QC gère les ressources de son quartier, le CD celles de toute la ville.
  // Le LC organise les transferts mais ne touche pas directement aux stocks.
  private async assertCanManage(
    quarter: { id: number; code: string },
    userId: number,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Ton compte est introuvable, il a sûrement été supprimé. Déconnecte-toi puis reconnecte-toi, ou crée un nouveau compte.");
    }

    const ownQuarter = user.role === 'QC' && user.quarterId === quarter.id;
    if (user.role !== 'CD' && user.role !== 'ADMIN' && !ownQuarter) {
      throw new PermissionException(
        `Tu ne peux pas modifier ce stock : seuls le QC du quartier ${quarter.code} et le CD en ont le droit. Demande-leur de faire la modification.`,
      );
    }
  }

  // Distingue le stock qui manque vraiment du stock que la rétention protège
  private refusal(
    code: string,
    inventory: InventoryRow,
    target: number,
    floor: number,
  ) {
    if (target < 0) {
      return new ConflictException(
        `Stock insuffisant : il reste seulement ${inventory.quantity} unité(s) de ${inventory.resourceType.name} dans le quartier ${code}. Retire une quantité plus petite.`,
      );
    }

    return new RetentionException(
      `Rétention : le quartier ${code} doit conserver au moins ${floor} unité(s) de ${inventory.resourceType.name} sur une dotation de ${inventory.initialQuantity}. Garde le stock à ${floor} unité(s) ou plus.`,
    );
  }

  private async requireInventory(code: string, resourceTypeId: number) {
    const quarter = await this.quarters.requireByCode(code);
    await this.resources.requireById(resourceTypeId);

    const inventory = await this.prisma.inventory.findUnique({
      where: {
        quarterId_resourceTypeId: { quarterId: quarter.id, resourceTypeId },
      },
      include: { resourceType: true },
    });

    if (!inventory) {
      throw new NotFoundException(
        `Le quartier ${quarter.code} n'a pas de stock pour la ressource n°${resourceTypeId}. Choisis une ressource présente dans l'inventaire de ce quartier.`,
      );
    }

    return inventory;
  }

  private toView(inventory: InventoryRow, quarter: RetentionState) {
    const floor = retentionFloor(inventory.initialQuantity, quarter);

    return {
      resourceTypeId: inventory.resourceType.id,
      resourceType: inventory.resourceType.name,
      initialQuantity: inventory.initialQuantity,
      quantity: inventory.quantity,
      retentionFloor: floor,
      releasable: Math.max(0, inventory.quantity - floor),
    };
  }
}
