import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DisastersModule } from '../disasters/disasters.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [PassportModule, DisastersModule, WebsocketModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}
