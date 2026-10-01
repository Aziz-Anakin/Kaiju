import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { QuartersModule } from './quarters/quarters.module';
import { ResourcesModule } from './resources/resources.module';
import { InventoryModule } from './inventory/inventory.module';
import { ReservationsModule } from './reservations/reservations.module';
import { TransfersModule } from './transfers/transfers.module';
import { DisastersModule } from './disasters/disasters.module';
import { WebsocketModule } from './websocket/websocket.module';


@Module({
  imports: [
    // Charge les variables du .env à la racine pour toute l'application
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    // Donne accès à la base de données dans tous les modules
    PrismaModule,
    // Chaque module correspond à une fonctionnalité du projet
    AuthModule,
    UsersModule,
    QuartersModule,
    ResourcesModule,
    InventoryModule,
    ReservationsModule,
    TransfersModule,
    DisastersModule,
    WebsocketModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
