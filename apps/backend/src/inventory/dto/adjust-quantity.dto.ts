import { IsInt } from 'class-validator';

export class AdjustQuantityDto {
  @IsInt({ message: 'La variation de stock doit être un nombre entier, par exemple 5 pour ajouter ou -3 pour retirer.' })
  delta: number;
}
