import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  UnprocessableEntityException,
} from '@nestjs/common';

// Le sujet exige que chaque refus dise quelle règle il applique. Chacune des
// trois règles de l'annexe a donc son propre code HTTP, qu'aucune autre
// n'utilise, et le corps de la réponse la nomme dans le champ « rule ».

// 403 : le rôle ou le niveau de crise n'ouvre pas ce droit
export class PermissionException extends ForbiddenException {
  constructor(message: string) {
    super({
      statusCode: HttpStatus.FORBIDDEN,
      error: 'Forbidden',
      rule: 'permission',
      message,
    });
  }
}

// 422 : la demande ne respecte pas la carte de la ville (voisinage, transit,
// priorités de voisinage)
export class AdjacencyException extends UnprocessableEntityException {
  constructor(message: string) {
    super({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      error: 'Unprocessable Entity',
      rule: 'adjacency',
      message,
    });
  }
}

// 423 : les unités demandées sont verrouillées dans le quartier par sa rétention
export class RetentionException extends HttpException {
  constructor(message: string) {
    super(
      {
        statusCode: HttpStatus.LOCKED,
        error: 'Locked',
        rule: 'retention',
        message,
      },
      HttpStatus.LOCKED,
    );
  }
}
