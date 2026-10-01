import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionException } from '../../common/rule.exceptions';
import { RolesGuard } from './roles.guard';

function contextWithRole(role: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { role } }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('laisse passer un rôle autorisé', () => {
    const reflector = { getAllAndOverride: () => ['CD'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextWithRole('CD'))).toBe(true);
  });

  // Un simple false donnerait un 403 « Forbidden resource » sans explication
  it('refuse un rôle qui n\'est pas autorisé', () => {
    const reflector = { getAllAndOverride: () => ['CD'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(contextWithRole('QC'))).toThrow(
      PermissionException,
    );
  });

  it('dit quel rôle était attendu', () => {
    const reflector = { getAllAndOverride: () => ['CD'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(contextWithRole('QC'))).toThrow(/CD/);
  });

  it('laisse passer quand la route ne demande aucun rôle', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextWithRole('QC'))).toBe(true);
  });
});
