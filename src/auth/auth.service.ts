import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthUser, JwtUserPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          passwordHash,
          role: Role.USER,
        },
      });

      return this.createAuthResponse(this.toAuthUser(user));
    } catch (e: unknown) {
      if (this.isUniqueConstraint(e)) {
        throw new ConflictException(`Email already in use: ${dto.email}`);
      }
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    const invalidCredentials = new UnauthorizedException('Invalid credentials');
    if (!user) {
      throw invalidCredentials;
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw invalidCredentials;
    }

    return this.createAuthResponse(this.toAuthUser(user));
  }

  private createAuthResponse(user: AuthUser): AuthResponseDto {
    const payload: JwtUserPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      user,
      accessToken: this.jwtService.sign(payload),
    };
  }

  private toAuthUser(user: {
    id: number;
    name: string;
    email: string;
    role: Role;
    championPick?: string | null;
    topScorerPick?: string | null;
  }): AuthUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      championPick: user.championPick ?? null,
      topScorerPick: user.topScorerPick ?? null,
    };
  }

  private isUniqueConstraint(e: unknown): boolean {
    return (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === 'P2002'
    );
  }
}
