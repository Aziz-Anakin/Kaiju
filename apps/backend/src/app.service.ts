import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // Permet de vérifier rapidement que l'API est bien en ligne
  getHealth() {
    return { status: 'ok' };
  }
}
