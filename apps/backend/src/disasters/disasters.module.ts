import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { WebsocketModule } from '../websocket/websocket.module';
import { DisastersController } from './disasters.controller';
import { DisastersService } from './disasters.service';

@Module({
  imports: [PassportModule, WebsocketModule],
  controllers: [DisastersController],
  providers: [DisastersService],
  exports: [DisastersService],
})
export class DisastersModule {}
