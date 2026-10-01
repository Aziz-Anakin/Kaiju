import { IsEmail, IsString, MinLength, IsEnum, IsInt, ValidateIf } from 'class-validator';
import { Role } from '../../generated/prisma/enums';

export class CreateUserDto {
  @IsEmail({}, { message: "Cet email n'est pas valide. Écris-le sous la forme nom@exemple.fr." })
  email: string;

  @IsString({ message: 'Choisis un mot de passe.' })
  @MinLength(8, {
    message: 'Le mot de passe est trop court. Utilise au moins 8 caractères.',
  })
  password: string;

  @IsString({ message: 'Indique ton nom.' })
  name: string;

  @IsEnum(Role, { message: "Ce rôle n'existe pas. Choisis QC, LC, CD ou ADMIN." })
  role: Role;

  @ValidateIf((dto) => dto.role === Role.QC)
  @IsInt({ message: 'Choisis ton quartier dans la liste.' })
  quarterId?: number;
}
