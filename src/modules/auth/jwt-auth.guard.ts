import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { IncomingMessage } from 'node:http';
import type { AuthUser, JwtPayload } from './auth.types.js';
import { extractBearerToken } from './bearer-token.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<IncomingMessage & { user?: AuthUser }>();
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException('Token ausente');
    }

    try {
      // algorithms fixo: rejeita alg "none" e troca de algoritmo.
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        algorithms: ['HS256'],
      });
      request.user = {
        id: Number(payload.sub),
        username: payload.username,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
