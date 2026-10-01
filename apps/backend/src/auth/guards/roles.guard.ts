import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PermissionException } from '../../common/rule.exceptions';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!requiredRoles.includes(user.role)) {
      // Le sujet refuse les erreurs génériques : on dit quel rôle il fallait
      throw new PermissionException(
        `Tu ne peux pas faire cette action : elle est réservée au rôle ${requiredRoles.join(' ou ')} et ton rôle est ${user.role}. Demande à un ${requiredRoles.join(' ou ')} de s'en charger.`,
      );
    }
    return true;
  }
}
