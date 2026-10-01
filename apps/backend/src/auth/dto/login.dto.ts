import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: "Cet email n'est pas valide. Écris-le sous la forme nom@exemple.fr." })
  email: string;

  @IsString({ message: 'Entre ton mot de passe pour te connecter.' })
  password: string;
}