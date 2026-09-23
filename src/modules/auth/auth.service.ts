import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import type { JwtPayload } from './auth.types.js';

const DUMMY_HASH = '$2b$10$td2/MqiDmHTmLG1YeWDTGeIX4mYTou4SdJXV6vWFsep7Vz2XStdOq';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: string, password: string): Promise<{ accessToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { username } });
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload: JwtPayload = {
      sub: String(user.id),
      username: user.username,
      role: user.role,
    };
    return { accessToken: await this.jwt.signAsync(payload) };
  }
}
