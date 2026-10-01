import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InventoryService } from './inventory.service';
import { AdjustQuantityDto } from './dto/adjust-quantity.dto';
import { SetQuantityDto } from './dto/set-quantity.dto';

type AuthRequest = { user: { userId: number } };

// L'annexe réserve la consultation des ressources aux officiers connectés
@UseGuards(JwtAuthGuard)
@Controller('quarters/:code/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findByQuarter(@Param('code') code: string) {
    return this.inventoryService.findByQuarter(code);
  }

  @Get(':resourceId')
  findOne(
    @Param('code') code: string,
    @Param('resourceId', ParseIntPipe) resourceId: number,
  ) {
    return this.inventoryService.findOne(code, resourceId);
  }

  // PATCH pour une variation relative, PUT pour imposer une valeur
  @Patch(':resourceId')
  adjust(
    @Param('code') code: string,
    @Param('resourceId', ParseIntPipe) resourceId: number,
    @Body() dto: AdjustQuantityDto,
    @Req() req: AuthRequest,
  ) {
    return this.inventoryService.adjust(
      code,
      resourceId,
      dto.delta,
      req.user.userId,
    );
  }

  @Put(':resourceId')
  setQuantity(
    @Param('code') code: string,
    @Param('resourceId', ParseIntPipe) resourceId: number,
    @Body() dto: SetQuantityDto,
    @Req() req: AuthRequest,
  ) {
    return this.inventoryService.setQuantity(
      code,
      resourceId,
      dto.quantity,
      req.user.userId,
    );
  }
}
