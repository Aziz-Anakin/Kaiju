import { IsInt, IsOptional, IsString, Min } from 'class-validator';

// Données envoyées pour demander une ressource à un autre quartier
export class CreateTransferDto {
  @IsString({ message: 'Choisis le quartier qui donne dans la liste.' })
  fromQuarter: string;

  @IsString({
    message: 'Choisis le quartier qui reçoit dans la liste.',
  })
  toQuarter: string;

  @IsString({
    message: 'Choisis la ressource à transférer dans la liste.',
  })
  resource: string;

  @IsInt({ message: 'La quantité doit être un nombre entier, par exemple 5.' })
  @Min(1, { message: "La quantité doit être d'au moins 1 unité. Indique un nombre supérieur à 0." })
  quantity: number;

  // Facultatif : sans lui, le serveur choisit lui-même le quartier traversé
  @IsOptional()
  @IsString({ message: 'Choisis le quartier de transit dans la liste, ou laisse le champ vide.' })
  transitQuarter?: string;
}
