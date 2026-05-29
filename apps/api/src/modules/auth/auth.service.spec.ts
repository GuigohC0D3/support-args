import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { RedisService } from './redis.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: bcrypt.hashSync('password123', 10),
  isMasterAdmin: false,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  avatarUrl: null,
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  userSession: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockRedis = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
};

const mockConfig = {
  getOrThrow: jest.fn().mockReturnValue('test-secret'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: JwtService, useValue: mockJwt },
        { provide: 'ConfigService', useValue: mockConfig },
      ],
    })
      .overrideProvider('ConfigService')
      .useValue(mockConfig)
      .compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('retorna tokens com credenciais válidas', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);
      mockPrisma.userSession.create.mockResolvedValue({});
      mockRedis.set.mockResolvedValue('OK');

      const result = await service.login(
        { email: 'test@example.com', password: 'password123' },
        '127.0.0.1',
        'jest-test',
      );

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
    });

    it('lança UnauthorizedException para email inexistente', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'naoexiste@example.com', password: '123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException para senha incorreta', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('lança UnauthorizedException para usuário inativo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(
        service.login({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('retorna novo accessToken com refreshToken válido', async () => {
      mockRedis.get.mockResolvedValue('user-1');
      mockPrisma.userSession.findUnique.mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        refreshToken: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000),
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.userSession.update.mockResolvedValue({});
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      const result = await service.refresh('valid-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockRedis.del).toHaveBeenCalledWith('refresh:valid-token');
    });

    it('lança UnauthorizedException para refreshToken inválido', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(service.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('remove o token do Redis e do banco', async () => {
      mockRedis.del.mockResolvedValue(1);
      mockPrisma.userSession.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout('some-token');

      expect(mockRedis.del).toHaveBeenCalledWith('refresh:some-token');
      expect(mockPrisma.userSession.deleteMany).toHaveBeenCalledWith({
        where: { refreshToken: 'some-token' },
      });
    });
  });
});
