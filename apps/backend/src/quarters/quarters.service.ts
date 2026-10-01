import { Injectable, NotFoundException } from '@nestjs/common';
import { DisastersService } from '../disasters/disasters.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuartersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly disasters: DisastersService,
  ) {}

  // Les codes du sujet sont en majuscules, on tolère "a" ou " a " côté client
  private normalize(code: string): string {
    return code.trim().toUpperCase();
  }

  findAll() {
    return this.prisma.quarter.findMany({ orderBy: { code: 'asc' } });
  }

  // Renvoie le quartier ou lève une 404. Les autres modules s'appuient dessus
  // pour transformer un code en quartier sans réécrire la vérification.
  async requireByCode(code: string) {
    const normalized = this.normalize(code);
    const quarter = await this.prisma.quarter.findUnique({
      where: { code: normalized },
    });

    if (!quarter) {
      throw new NotFoundException(`Le quartier ${normalized} n'existe pas. Utilise un code de quartier valide, par exemple A ou E.`);
    }

    return quarter;
  }

  // Détail d'un quartier, avec les codes de ses voisins pour la carte du frontend
  async findOne(code: string) {
    const normalized = this.normalize(code);
    const quarter = await this.prisma.quarter.findUnique({
      where: { code: normalized },
      include: { neighbors: { include: { neighbor: true } } },
    });

    if (!quarter) {
      throw new NotFoundException(`Le quartier ${normalized} n'existe pas. Utilise un code de quartier valide, par exemple A ou E.`);
    }

    const { neighbors, ...rest } = quarter;

    return {
      ...rest,
      neighbors: neighbors.map((adjacency) => adjacency.neighbor.code).sort(),
    };
  }

  // Voisins directs d'un quartier, triés par code
  async findNeighbors(code: string) {
    const quarter = await this.requireByCode(code);

    const links = await this.prisma.adjacency.findMany({
      where: { quarterId: quarter.id },
      include: { neighbor: true },
      orderBy: { neighbor: { code: 'asc' } },
    });

    return links.map((link) => link.neighbor);
  }

  // Utilisé par les transferts : est-ce que ces deux quartiers se touchent ?
  // L'adjacence est enregistrée dans les deux sens, une seule lecture suffit.
  async areAdjacent(codeA: string, codeB: string): Promise<boolean> {
    const [from, to] = await Promise.all([
      this.requireByCode(codeA),
      this.requireByCode(codeB),
    ]);

    // Un quartier n'est pas son propre voisin : un transfert vers soi-même
    // n'a aucun sens et doit être refusé comme non adjacent.
    if (from.id === to.id) {
      return false;
    }

    const link = await this.prisma.adjacency.findUnique({
      where: {
        quarterId_neighborId: { quarterId: from.id, neighborId: to.id },
      },
    });

    return link !== null;
  }

  // Abaisse la rétention d'un quartier de 30 % à 15 %, ou la rétablit.
  // On ne décide rien ici : la matrice de crise dit qui a le droit et à quel
  // niveau, et elle ne l'ouvre qu'au City Director sur un quartier au niveau 5.
  async setRetention(code: string, lowered: boolean, userId: number) {
    const quarter = await this.requireByCode(code);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Ton compte est introuvable, il a sûrement été supprimé. Déconnecte-toi puis reconnecte-toi, ou crée un nouveau compte.");
    }

    await this.disasters.checkPermission(
      quarter.code,
      user.role,
      'lowerRetention',
    );

    return this.prisma.quarter.update({
      where: { id: quarter.id },
      data: { retentionLowered: lowered },
    });
  }
}
