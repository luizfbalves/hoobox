import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { UserRole } from '../../../generated/prisma/enums.js';
import type { AuthUser } from '../auth.types.js';
import { RolesGuard } from '../roles.guard.js';

function contextWith(user?: AuthUser): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function reflectorReturning(roles?: UserRole[]): Reflector {
  return { getAllAndOverride: vi.fn().mockReturnValue(roles) } as unknown as Reflector;
}

const admin: AuthUser = { id: 1, username: 'admin', role: UserRole.ADMIN };
const user: AuthUser = { id: 2, username: 'user', role: UserRole.USER };

describe('RolesGuard', () => {
  it('libera rota sem @Roles', () => {
    expect(new RolesGuard(reflectorReturning(undefined)).canActivate(contextWith(user))).toBe(true);
  });

  it('libera quando @Roles() tem lista vazia', () => {
    expect(new RolesGuard(reflectorReturning([])).canActivate(contextWith(user))).toBe(true);
  });

  it('libera quando o usuário tem a role exigida', () => {
    expect(
      new RolesGuard(reflectorReturning([UserRole.ADMIN])).canActivate(contextWith(admin)),
    ).toBe(true);
  });

  it('nega com 403 quando a role não confere', () => {
    expect(() =>
      new RolesGuard(reflectorReturning([UserRole.ADMIN])).canActivate(contextWith(user)),
    ).toThrow(ForbiddenException);
  });

  it('nega com 403 quando não há usuário autenticado', () => {
    expect(() =>
      new RolesGuard(reflectorReturning([UserRole.ADMIN])).canActivate(contextWith(undefined)),
    ).toThrow(ForbiddenException);
  });
});
