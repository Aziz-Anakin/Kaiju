import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SetRetentionDto } from './dto/set-retention.dto';
import { QuartersService } from './quarters.service';

type AuthRequest = { user: { userId: number } };

@Controller('quarters')
export class QuartersController {
  constructor(private readonly quartersService: QuartersService) {}

  @Get()
  findAll() {
    return this.quartersService.findAll();
  }

  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.quartersService.findOne(code);
  }

  // Voisins directs, utilisés par la carte du frontend et par les transferts
  @Get(':code/neighbors')
  findNeighbors(@Param('code') code: string) {
    return this.quartersService.findNeighbors(code);
  }

  // Abaisse la rétention de 30 % à 15 %. Le service vérifie le droit auprès
  // de la matrice, qui ne l'ouvre qu'au City Director et au niveau 5.
  @UseGuards(JwtAuthGuard)
  @Patch(':code/retention')
  setRetention(
    @Param('code') code: string,
    @Body() dto: SetRetentionDto,
    @Req() req: AuthRequest,
  ) {
    return this.quartersService.setRetention(code, dto.lowered, req.user.userId);
  }
}
