import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  const create = jest.fn();
  const findUnique = jest.fn();
  const sign = jest.fn();

  let service: AuthService;

  beforeEach(() => {
    create.mockReset();
    findUnique.mockReset();
    sign.mockReset();

    service = new AuthService(
      {
        user: {
          create,
          findUnique,
        },
      } as unknown as PrismaService,
      { sign } as unknown as JwtService,
    );
  });

  it('registers a user, hashes password and returns token contract', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    create.mockResolvedValue({
      id: 10,
      name: 'Ana',
      email: 'ana@example.com',
      passwordHash: 'hashed-password',
      role: Role.USER,
      championPick: 'Argentina',
      topScorerPick: 'Messi',
    });
    sign.mockReturnValue('signed-jwt');

    await expect(
      service.register({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'strongpass',
      }),
    ).resolves.toEqual({
      user: {
        id: 10,
        name: 'Ana',
        email: 'ana@example.com',
        role: Role.USER,
        championPick: 'Argentina',
        topScorerPick: 'Messi',
      },
      accessToken: 'signed-jwt',
    });

    expect(bcrypt.hash).toHaveBeenCalledWith('strongpass', 10);
    expect(sign).toHaveBeenCalledWith({
      sub: 10,
      email: 'ana@example.com',
      role: Role.USER,
    });
  });

  it('rejects duplicate email on register', async () => {
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.register({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'strongpass',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in with valid credentials and signs token', async () => {
    findUnique.mockResolvedValue({
      id: 20,
      name: 'Beto',
      email: 'beto@example.com',
      passwordHash: 'stored-hash',
      role: Role.ADMIN,
      championPick: null,
      topScorerPick: null,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    sign.mockReturnValue('admin-token');

    await expect(
      service.login({
        email: 'beto@example.com',
        password: 'correctpass',
      }),
    ).resolves.toEqual({
      user: {
        id: 20,
        name: 'Beto',
        email: 'beto@example.com',
        role: Role.ADMIN,
        championPick: null,
        topScorerPick: null,
      },
      accessToken: 'admin-token',
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'beto@example.com' },
    });
    expect(bcrypt.compare).toHaveBeenCalledWith('correctpass', 'stored-hash');
    expect(sign).toHaveBeenCalledWith({
      sub: 20,
      email: 'beto@example.com',
      role: Role.ADMIN,
    });
  });

  it('rejects login when email does not exist', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'missing@example.com',
        password: 'doesnotmatter',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects login when password is invalid', async () => {
    findUnique.mockResolvedValue({
      id: 21,
      name: 'Caro',
      email: 'caro@example.com',
      passwordHash: 'stored-hash',
      role: Role.USER,
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(
      service.login({
        email: 'caro@example.com',
        password: 'badpass123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
