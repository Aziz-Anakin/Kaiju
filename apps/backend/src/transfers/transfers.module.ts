import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DisastersModule } from '../disasters/disasters.module';
import { InventoryModule } from '../inventory/inventory.module';
import { QuartersModule } from '../quarters/quarters.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [
    PassportModule,
    WebsocketModule,
    QuartersModule,
    DisastersModule,
    InventoryModule,
  ],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
