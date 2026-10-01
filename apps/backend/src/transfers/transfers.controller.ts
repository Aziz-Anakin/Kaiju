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
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransfersService } from './transfers.service';

type AuthRequest = { user: { userId: number } };

// Toutes les routes des transferts demandent un officier connecté avec son token
@UseGuards(JwtAuthGuard)
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  findAll() {
    return this.transfersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.transfersService.findOne(id);
  }

  // L'officier connecté est enregistré comme celui qui fait la demande
  @Post()
  create(@Body() dto: CreateTransferDto, @Req() req: AuthRequest) {
    return this.transfersService.create(dto, req.user.userId);
  }

  // Les deux routes suivantes répondent à une demande en changeant son statut
  @Patch(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.transfersService.answer(id, req.user.userId, 'APPROVED');
  }

  @Patch(':id/reject')
  reject(@Param('id', ParseIntPipe) id: number, @Req() req: AuthRequest) {
    return this.transfersService.answer(id, req.user.userId, 'REJECTED');
  }
}
