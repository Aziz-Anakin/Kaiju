import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Autorise le frontend à appeler l'API depuis son adresse
  app.enableCors({ origin: process.env.CORS_ORIGIN?.split(',') });

  // Vérifie automatiquement les données reçues grâce aux DTO
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Documentation de l'API disponible sur /docs
  const config = new DocumentBuilder()
    .setTitle('KAIJU API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();