import type { UserRole } from '../../generated/prisma/enums.js';

export type AuthUser = { id: number; username: string; role: UserRole };

export type JwtPayload = { sub: string; username: string; role: UserRole };
