import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DisastersService } from './disasters.service';
import { UpdateLevelDto } from './dto/update-level.dto';

@Controller('disasters')
export class DisastersController {
  constructor(private readonly disastersService: DisastersService) {}

  @Get()
  findAll() {
    return this.disastersService.findAll();
  }

  @Get(':quarter')
  findOne(@Param('quarter') quarter: string) {
    return this.disastersService.findOne(quarter);
  }

  // Seul le City Director connecté peut changer le niveau de crise d'un quartier
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CD', 'ADMIN')
  @Patch(':quarter')
  updateLevel(@Param('quarter') quarter: string, @Body() dto: UpdateLevelDto) {
    return this.disastersService.updateLevel(quarter, dto.level);
  }
}
