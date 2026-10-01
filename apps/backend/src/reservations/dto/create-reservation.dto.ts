import { IsDateString, IsInt, IsString, Min } from 'class-validator';

export class CreateReservationDto {
  // Id de l'officier qui réserve en attendant que l'auth donne l'utilisateur connecté
  @IsInt({ message: 'Ta session semble invalide. Déconnecte-toi puis reconnecte-toi.' })
  userId: number;

  @IsString({ message: 'Choisis un quartier dans la liste.' })
  quarter: string;

  @IsString({
    message: 'Choisis une ressource dans la liste.',
  })
  resource: string;

  @IsInt({ message: 'La quantité doit être un nombre entier, par exemple 5.' })
  @Min(1, { message: "La quantité doit être d'au moins 1 unité. Indique un nombre supérieur à 0." })
  quantity: number;

  @IsDateString({}, { message: "La date de début n'est pas valide. Choisis-la avec le sélecteur de date." })
  startDate: string;

  @IsDateString({}, { message: "La date de fin n'est pas valide. Choisis-la avec le sélecteur de date." })
  endDate: string;
}
