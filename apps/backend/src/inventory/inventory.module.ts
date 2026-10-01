import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { QuartersModule } from '../quarters/quarters.module';
import { ResourcesModule } from '../resources/resources.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [PassportModule, QuartersModule, ResourcesModule, WebsocketModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
