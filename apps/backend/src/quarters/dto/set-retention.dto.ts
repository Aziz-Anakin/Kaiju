import { IsBoolean } from 'class-validator';

// Corps envoyé par le City Director pour abaisser ou rétablir la rétention
export class SetRetentionDto {
  @IsBoolean({ message: 'Indique si la rétention doit être abaissée (oui) ou rétablie (non).' })
  lowered: boolean;
}
