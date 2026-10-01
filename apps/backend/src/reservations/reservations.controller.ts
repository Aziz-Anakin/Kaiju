import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ReservationsService } from './reservations.service';

type AuthRequest = { user: { userId: number } };

// Toutes les routes des réservations demandent un officier connecté avec son token
@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  findAll() {
    return this.reservationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reservationsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.reservationsService.create(dto);
  }

  // L'officier connecté est lu dans le token pour vérifier s'il a le droit d'agir
  @Patch(':id/confirm')
  confirm(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.reservationsService.confirm(id, req.user.userId);
  }

  @Patch(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.reservationsService.cancel(id, req.user.userId);
  }
}
