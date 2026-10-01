import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../generated/prisma/enums';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Cet email est déjà utilisé par un autre compte. Utilise une autre adresse email, ou connecte-toi avec ce compte.');

    if (dto.role === Role.QC) {
      const quarterTaken = await this.prisma.user.findFirst({
        where: { role: Role.QC, quarterId: dto.quarterId },
      });
      if (quarterTaken) throw new ConflictException("Ce quartier a déjà un Quarter Coordinator. Choisis un autre quartier, ou change d'abord le rôle de l'actuel coordinateur.");
    }

    return this.prisma.user.create({ data: dto });
  }

  // Création par l'admin : le mot de passe est hashé et jamais renvoyé
  async createAsAdmin(dto: CreateUserDto) {
    const password = await bcrypt.hash(dto.password, 10);
    const { password: _password, ...user } = await this.create({
      ...dto,
      password,
    });
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // Jamais le hash du mot de passe dans une réponse d'API
  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        quarterId: true,
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException("Ce compte n'existe plus, il a peut-être été supprimé. Recharge la page pour voir la liste à jour.");
    return user;
  }

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        quarterId: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  // Change le rôle d'un compte. Un admin ne modifie pas son propre compte,
  // sinon il pourrait retirer le dernier accès d'administration.
  async update(id: number, dto: UpdateUserDto, actorId: number) {
    if (id === actorId) {
      throw new BadRequestException('Tu ne peux pas modifier ton propre compte. Demande à un autre administrateur de le faire.');
    }
    await this.findById(id);

    if (dto.role === Role.QC) {
      const taken = await this.prisma.user.findFirst({
        where: { role: Role.QC, quarterId: dto.quarterId, NOT: { id } },
      });
      if (taken) {
        throw new ConflictException("Ce quartier a déjà un Quarter Coordinator. Choisis un autre quartier, ou change d'abord le rôle de l'actuel coordinateur.");
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        role: dto.role,
        quarterId: dto.role === Role.QC ? dto.quarterId : null,
      },
      select: { id: true, email: true, name: true, role: true, quarterId: true },
    });
  }

  async remove(id: number, actorId: number) {
    if (id === actorId) {
      throw new BadRequestException('Tu ne peux pas supprimer ton propre compte. Demande à un autre administrateur de le faire.');
    }
    await this.findById(id);

    try {
      await this.prisma.user.delete({ where: { id } });
    } catch {
      // Les réservations et transferts du compte le rattachent à l'historique
      throw new ConflictException(
        "Ce compte ne peut pas être supprimé car il est lié à des réservations ou des transferts qui doivent rester dans l'historique. Garde-le, ou change plutôt son rôle.",
      );
    }
    return { id };
  }
}