import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '../generated/prisma/enums';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  // L'inscription publique crée toujours un Quarter Coordinator, quel que soit
  // le rôle envoyé. Sinon n'importe qui se déclarerait City Director en
  // envoyant role: 'CD' et contournerait toute la matrice de permissions.
  async register(dto: CreateUserDto) {
    if (dto.quarterId === undefined) {
      throw new BadRequestException(
        'Choisis ton quartier dans la liste pour créer ton compte : un Quarter Coordinator doit être rattaché à un quartier.',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const { password: _password, ...result } = await this.usersService.create({
      email: dto.email,
      name: dto.name,
      password: hashedPassword,
      role: Role.QC,
      quarterId: dto.quarterId,
    });
    return result;
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException("Email ou mot de passe incorrect. Vérifie ta saisie et réessaie, ou crée un compte si tu n'en as pas encore.");

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) throw new UnauthorizedException("Email ou mot de passe incorrect. Vérifie ta saisie et réessaie, ou crée un compte si tu n'en as pas encore.");

    const payload = { sub: user.id, email: user.email, role: user.role };
    const token = await this.jwtService.signAsync(payload);

    return { access_token: token };
  }
}
