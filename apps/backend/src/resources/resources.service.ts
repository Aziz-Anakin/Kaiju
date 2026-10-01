import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.resourceType.findMany({ orderBy: { name: 'asc' } });
  }

  async requireById(id: number) {
    const resourceType = await this.prisma.resourceType.findUnique({
      where: { id },
    });

    if (!resourceType) {
      throw new NotFoundException(`La ressource n°${id} n'existe pas. Choisis une ressource dans la liste des ressources.`);
    }

    return resourceType;
  }

  // On expose la dotation initiale, pas le stock courant qui relève de l'inventaire
  async findOne(id: number) {
    const resourceType = await this.requireById(id);

    const inventories = await this.prisma.inventory.findMany({
      where: { resourceTypeId: resourceType.id },
      include: { quarter: true },
      orderBy: { quarter: { code: 'asc' } },
    });

    return {
      ...resourceType,
      initialQuantities: inventories.map((inventory) => ({
        quarter: inventory.quarter.code,
        initialQuantity: inventory.initialQuantity,
      })),
    };
  }
}
