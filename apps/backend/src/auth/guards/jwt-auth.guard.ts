import { Injectable, Optional } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthModuleOptions } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Optional() options?: AuthModuleOptions) {
    super(options);
  }
}