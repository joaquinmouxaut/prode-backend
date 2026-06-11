import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { MatchLifecycleService } from '../matches/match-lifecycle.service';
import { PredictionsService } from '../predictions/predictions.service';
import { ParticipantsService } from './participants.service';

describe('ParticipantsService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
  };
  const matchLifecycle = {
    hasTournamentStarted: jest.fn(),
  };
  const predictions = {
    findVisible: jest.fn(),
  };
  let service: ParticipantsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ParticipantsService(
      prisma as never,
      matchLifecycle as unknown as MatchLifecycleService,
      predictions as unknown as PredictionsService,
    );
  });

  it('returns a visible profile for tournament participants', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 2,
      name: 'Bruno',
      email: 'bruno@example.com',
      role: Role.USER,
      championPick: 'Argentina',
      topScorerPick: 'Messi',
      totalPoints: 12,
      championPoints: 0,
      topScorerPoints: 0,
      groups1: 12,
      groups2: 0,
      groups3: 0,
      knockout: 0,
    });
    matchLifecycle.hasTournamentStarted.mockResolvedValue(true);
    predictions.findVisible.mockResolvedValue([
      {
        id: 9,
        userId: 2,
        matchId: 3,
        homeGoals: 2,
        awayGoals: 1,
        points: 8,
      },
    ]);

    await expect(service.getProfile(1, 2)).resolves.toMatchObject({
      user: { id: 2, name: 'Bruno' },
      tournamentPicksVisible: true,
      championPick: 'Argentina',
      topScorerPick: 'Messi',
      predictions: [{ id: 9 }],
    });
    expect(predictions.findVisible).toHaveBeenCalledWith(1, { userId: 2 });
  });

  it('hides tournament picks before kickoff', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 2,
      name: 'Bruno',
      email: 'bruno@example.com',
      role: Role.USER,
      championPick: 'Argentina',
      topScorerPick: 'Messi',
      totalPoints: 0,
      championPoints: 0,
      topScorerPoints: 0,
      groups1: 0,
      groups2: 0,
      groups3: 0,
      knockout: 0,
    });
    matchLifecycle.hasTournamentStarted.mockResolvedValue(false);
    predictions.findVisible.mockResolvedValue([]);

    const profile = await service.getProfile(1, 2);

    expect(profile.tournamentPicksVisible).toBe(false);
    expect(profile.championPick).toBeNull();
    expect(profile.topScorerPick).toBeNull();
  });

  it('rejects admin profiles', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 9,
      role: Role.ADMIN,
    });

    await expect(service.getProfile(1, 9)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
