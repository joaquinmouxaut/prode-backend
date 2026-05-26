import { Injectable, NotFoundException } from '@nestjs/common';
import { Phase } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(phase?: Phase) {
    return this.prisma.match.findMany({
      where: phase ? { phase } : undefined,
      orderBy: [{ date: 'asc' }, { id: 'asc' }],
    });
  }

  async findOne(id: number) {
    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) {
      throw new NotFoundException(`Match ${id} not found`);
    }
    return match;
  }

  create(dto: CreateMatchDto) {
    return this.prisma.match.create({
      data: {
        homeTeam: dto.homeTeam,
        awayTeam: dto.awayTeam,
        date: new Date(dto.date),
        phase: dto.phase,
        homeGoals: dto.homeGoals ?? null,
        awayGoals: dto.awayGoals ?? null,
      },
    });
  }

  async update(id: number, dto: UpdateMatchDto) {
    await this.findOne(id);
    const { date, ...rest } = dto;
    return this.prisma.match.update({
      where: { id },
      data: {
        ...rest,
        ...(date !== undefined ? { date: new Date(date) } : {}),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.match.delete({ where: { id } });
  }
}
