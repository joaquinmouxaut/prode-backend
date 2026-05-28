import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { AdminController } from '../admin/admin.controller';
import { MatchesController } from '../matches/matches.controller';
import { PredictionsController } from '../predictions/predictions.controller';
import { ROLES_KEY } from './decorators/roles.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

describe('Route protection metadata', () => {
  function getMethodTarget(
    prototype: object,
    methodName: string,
  ): (...args: unknown[]) => unknown {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
    if (!descriptor?.value) {
      throw new Error(`Missing method ${methodName}`);
    }
    return descriptor.value as (...args: unknown[]) => unknown;
  }

  function getGuardNames(prototype: object, methodName: string): string[] {
    const target = getMethodTarget(prototype, methodName);
    const guards = (Reflect.getMetadata(GUARDS_METADATA, target) ??
      []) as Array<{
      name?: string;
    }>;
    return guards.map((guard) => guard.name ?? '');
  }

  it('protects mutative matches routes with JwtAuthGuard', () => {
    expect(getGuardNames(MatchesController.prototype, 'create')).toContain(
      JwtAuthGuard.name,
    );
    expect(getGuardNames(MatchesController.prototype, 'update')).toContain(
      JwtAuthGuard.name,
    );
    expect(getGuardNames(MatchesController.prototype, 'remove')).toContain(
      JwtAuthGuard.name,
    );
  });

  it('protects mutative predictions routes with JwtAuthGuard', () => {
    expect(getGuardNames(PredictionsController.prototype, 'create')).toContain(
      JwtAuthGuard.name,
    );
    expect(getGuardNames(PredictionsController.prototype, 'update')).toContain(
      JwtAuthGuard.name,
    );
    expect(getGuardNames(PredictionsController.prototype, 'remove')).toContain(
      JwtAuthGuard.name,
    );
  });

  it('requires admin role on admin result mutation route', () => {
    expect(getGuardNames(AdminController.prototype, 'setMatchResult')).toEqual([
      JwtAuthGuard.name,
      RolesGuard.name,
    ]);
    const adminTarget = getMethodTarget(
      AdminController.prototype,
      'setMatchResult',
    );
    expect(Reflect.getMetadata(ROLES_KEY, adminTarget)).toEqual([Role.ADMIN]);
  });
});
