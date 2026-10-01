import { IsInt, Max, Min } from 'class-validator';

export class UpdateLevelDto {
  // Le niveau de crise doit être un nombre entier entre 1 et 5
  @IsInt({ message: 'Le niveau de crise doit être un nombre entier, par exemple 3.' })
  @Min(1, { message: 'Le niveau de crise ne peut pas être inférieur à 1. Choisis une valeur entre 1 et 5.' })
  @Max(5, { message: 'Le niveau de crise ne peut pas dépasser 5. Choisis une valeur entre 1 et 5.' })
  level: number;
}
