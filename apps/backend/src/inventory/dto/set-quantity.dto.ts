import { IsInt, Min } from 'class-validator';

export class SetQuantityDto {
  @IsInt({ message: 'La quantité doit être un nombre entier, par exemple 12.' })
  @Min(0, { message: 'La quantité ne peut pas être négative. Indique 0 ou plus.' })
  quantity: number;
}
