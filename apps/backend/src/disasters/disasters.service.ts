import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PermissionException } from '../common/rule.exceptions';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../websocket/events.gateway';

const LEVEL_NAMES: Record<number, string> = {
  1: 'Watch',
  2: 'Alert',
  3: 'Emergency',
  4: 'Critical',
  5: 'Catastrophic',
};

// Pour chaque action on liste les rôles autorisés du niveau 1 au niveau 5
const PERMISSIONS: Record<string, string[][]> = {
  view: [
    ['QC', 'LC', 'CD'],
    ['QC', 'LC', 'CD'],
    ['QC', 'LC', 'CD'],
    ['QC', 'LC', 'CD'],
    ['QC', 'LC', 'CD'],
  ],
  reserve: [[], ['QC'], ['QC'], ['QC'], ['QC']],
  adjacentTransfer: [[], [], ['QC'], ['QC', 'LC'], ['QC', 'LC', 'CD']],
  transit: [[], [], [], ['LC'], ['LC', 'CD']],
  requisition: [[], [], [], ['CD'], ['CD']],
  lowerRetention: [[], [], [], [], ['CD']],
};

// Nom de chaque action dans une phrase, pour les messages d'erreur
const ACTION_LABELS: Record<string, string> = {
  view: 'consulter ce quartier',
  reserve: 'réserver des ressources',
  adjacentTransfer: 'demander un transfert à un quartier voisin',
  transit: 'demander un transfert qui passe par un quartier de transit',
  requisition: 'réquisitionner des ressources',
  lowerRetention: 'abaisser la rétention',
};

@Injectable()
export class DisastersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  // Récupère le niveau de crise de tous les quartiers dans la base
  async findAll() {
    const quarters = await this.prisma.quarter.findMany({
      orderBy: { code: 'asc' },
    });
    return quarters.map((q) => ({
      quarter: q.code,
      level: q.disasterLevel,
      name: LEVEL_NAMES[q.disasterLevel],
    }));
  }

  async findOne(quarter: string) {
    const level = await this.getLevel(quarter);
    return { quarter, level, name: LEVEL_NAMES[level] };
  }

  async getLevel(quarter: string): Promise<number> {
    const found = await this.prisma.quarter.findUnique({
      where: { code: quarter },
    });
    if (!found) {
      throw new NotFoundException(`Le quartier ${quarter} n'existe pas. Choisis un quartier dans la liste.`);
    }
    return found.disasterLevel;
  }

  // Vérifie que le nouveau niveau est valide puis l'enregistre dans la base
  async updateLevel(quarter: string, level: number) {
    const currentLevel = await this.getLevel(quarter);

    if (!Number.isInteger(level) || level < 1 || level > 5) {
      throw new BadRequestException('Le niveau de crise doit être compris entre 1 et 5. Choisis une valeur dans cet intervalle.');
    }
    if (level === currentLevel) {
      throw new ConflictException(
        `Le quartier ${quarter} est déjà au niveau ${level}. Choisis un niveau différent pour le modifier.`,
      );
    }

    await this.prisma.quarter.update({
      where: { code: quarter },
      data: { disasterLevel: level },
    });

    // Prévient tous les navigateurs connectés que le niveau de crise a changé
    const updated = await this.findOne(quarter);
    this.events.broadcast('disaster-level-changed', updated);
    return updated;
  }

  // Dit à l'utilisateur ce qui débloquerait l'action : un niveau plus élevé
  // ou un autre rôle
  private unlockHint(action: string, role?: string): string {
    const levels = PERMISSIONS[action];
    const firstLevel = levels.findIndex((roles) =>
      role ? roles.includes(role) : roles.length > 0,
    );
    if (role && firstLevel >= 0) {
      return `Ton rôle y aura droit à partir du niveau ${firstLevel + 1}. En attendant, demande à un collègue qui a ce droit.`;
    }
    const allowed = [...new Set(levels.flat())];
    return `Elle ne s'ouvre qu'à partir du niveau ${levels.findIndex((roles) => roles.length > 0) + 1}, pour le rôle ${allowed.join(' ou ')}. Demande au City Director de changer le niveau de crise si la situation l'exige.`;
  }

  // Vérifie si un rôle a le droit de faire une action au niveau actuel du quartier
  async checkPermission(quarter: string, role: string, action: string) {
    const level = await this.getLevel(quarter);
    if (!(action in PERMISSIONS)) {
      throw new BadRequestException(`Cette action n'existe pas dans le système (${action}). Recharge la page et réessaie, et si le problème continue préviens un administrateur.`);
    }

    // L'ADMIN est au-dessus du CD : il a au moins tous ses droits
    const effectiveRole = role === 'ADMIN' ? 'CD' : role;
    const allowedRoles = PERMISSIONS[action][level - 1];

    // On refuse si personne n'a le droit ou si le rôle ne fait pas partie de la liste
    if (allowedRoles.length === 0) {
      throw new PermissionException(
        `Tu ne peux pas ${ACTION_LABELS[action] ?? action} : cette action est bloquée pour tout le monde au niveau ${level} (${LEVEL_NAMES[level]}) dans le quartier ${quarter}. ${this.unlockHint(action)}`,
      );
    }
    if (!allowedRoles.includes(effectiveRole)) {
      throw new PermissionException(
        `Tu ne peux pas ${ACTION_LABELS[action] ?? action} : ton rôle (${role}) n'a pas ce droit au niveau ${level} (${LEVEL_NAMES[level]}) dans le quartier ${quarter}. ${this.unlockHint(action, effectiveRole)}`,
      );
    }
  }
}
