import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from './redis.service';
import { LoginDto } from './dto/login.dto';

const REFRESH_TTL = 60 * 60 * 24 * 7; // 7 dias em segundos

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const tokens = await this.generateTokens(user.id, user.email, user.isMasterAdmin);

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken: tokens.refreshToken,
        ipAddress,
        userAgent,
        expiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return tokens;
  }

  async refresh(refreshToken: string) {
    const stored = await this.redis.get(`refresh:${refreshToken}`);
    if (!stored) throw new UnauthorizedException('Invalid or expired refresh token');

    const session = await this.prisma.userSession.findUnique({ where: { refreshToken } });
    if (!session || session.expiresAt < new Date()) {
      await this.redis.del(`refresh:${refreshToken}`);
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user || !user.isActive) throw new UnauthorizedException();

    const newTokens = await this.generateTokens(user.id, user.email, user.isMasterAdmin);

    await this.redis.del(`refresh:${refreshToken}`);
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        refreshToken: newTokens.refreshToken,
        expiresAt: new Date(Date.now() + REFRESH_TTL * 1000),
      },
    });

    return newTokens;
  }

  async logout(refreshToken: string) {
    await this.redis.del(`refresh:${refreshToken}`);
    await this.prisma.userSession.deleteMany({ where: { refreshToken } });
  }

  private async generateTokens(userId: string, email: string, isMasterAdmin: boolean) {
    const accessToken = this.jwt.sign({ sub: userId, email, isMasterAdmin });

    const refreshToken = uuidv4();
    await this.redis.set(`refresh:${refreshToken}`, userId, REFRESH_TTL);

    return { accessToken, refreshToken };
  }
}
