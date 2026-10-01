import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DisastersModule } from '../disasters/disasters.module';
import { QuartersController } from './quarters.controller';
import { QuartersService } from './quarters.service';

@Module({
  imports: [PassportModule, DisastersModule],
  controllers: [QuartersController],
  providers: [QuartersService],
  // Exporté pour que les transferts, l'inventaire et la rétention puissent
  // résoudre un code de quartier et vérifier l'adjacence.
  exports: [QuartersService],
})
export class QuartersModule {}
