import { IsEnum, IsInt, ValidateIf } from 'class-validator';
import { Role } from '../../generated/prisma/enums';

export class UpdateUserDto {
  @IsEnum(Role, { message: "Ce rôle n'existe pas. Choisis QC, LC, CD ou ADMIN." })
  role: Role;

  @ValidateIf((dto) => dto.role === Role.QC)
  @IsInt({ message: 'Choisis un quartier dans la liste pour ce Quarter Coordinator.' })
  quarterId?: number;
}
