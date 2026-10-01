import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Route appelée pour savoir si le backend répond
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
