import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly safeUserSelect = {
    id: true,
    name: true,
    email: true,
    role: true,
    championPick: true,
    topScorerPick: true,
    totalPoints: true,
    groups1: true,
    groups2: true,
    groups3: true,
    knockout: true,
  } as const;

  findAll() {
    return this.prisma.user.findMany({
      select: this.safeUserSelect,
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.safeUserSelect,
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async create(dto: CreateUserDto) {
    try {
      const { password, ...rest } = dto;
      const passwordHash = await bcrypt.hash(password, 10);
      return await this.prisma.user.create({
        data: {
          ...rest,
          passwordHash,
          role: Role.USER,
        },
        select: this.safeUserSelect,
      });
    } catch (e: unknown) {
      if (this.isUniqueConstraint(e)) {
        throw new ConflictException(`Email already in use: ${dto.email}`);
      }
      throw e;
    }
  }

  async update(id: number, dto: UpdateUserDto) {
    await this.findOne(id);
    try {
      return await this.prisma.user.update({
        where: { id },
        data: dto,
        select: this.safeUserSelect,
      });
    } catch (e: unknown) {
      if (this.isUniqueConstraint(e)) {
        throw new ConflictException('Email already in use');
      }
      throw e;
    }
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.user.delete({
      where: { id },
      select: this.safeUserSelect,
    });
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
