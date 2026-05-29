import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { AdminController } from '../admin/admin.controller';
import { LeaderboardController } from '../leaderboard/leaderboard.controller';
import { MatchesController } from '../matches/matches.controller';
import { AuthController } from './auth.controller';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { ROLES_KEY } from './decorators/roles.decorator';
import { RolesGuard } from './guards/roles.guard';

describe('Route access policy', () => {
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

  it('marks only auth register/login as public', () => {
    const registerTarget = getMethodTarget(
      AuthController.prototype,
      'register',
    );
    const loginTarget = getMethodTarget(AuthController.prototype, 'login');
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, registerTarget)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, loginTarget)).toBe(true);
  });

  it('does not mark read routes as public', () => {
    const matchesFindAllTarget = getMethodTarget(
      MatchesController.prototype,
      'findAll',
    );
    const leaderboardFindAllTarget = getMethodTarget(
      LeaderboardController.prototype,
      'findAll',
    );
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, matchesFindAllTarget),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, leaderboardFindAllTarget),
    ).toBeUndefined();
  });

  it('requires admin role on admin result route', () => {
    expect(getGuardNames(AdminController.prototype, 'setMatchResult')).toEqual([
      RolesGuard.name,
    ]);
    const adminTarget = getMethodTarget(
      AdminController.prototype,
      'setMatchResult',
    );
    expect(Reflect.getMetadata(ROLES_KEY, adminTarget)).toEqual([Role.ADMIN]);
  });
});
