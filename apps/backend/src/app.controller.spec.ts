import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  // On crée un module de test avec seulement le controller et le service
  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it("renvoie le statut ok de l'API", () => {
    expect(appController.getHealth()).toEqual({ status: 'ok' });
  });
});
