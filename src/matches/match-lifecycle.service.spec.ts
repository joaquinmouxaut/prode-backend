import { ConflictException } from '@nestjs/common';
import { MatchLifecycleService } from './match-lifecycle.service';

describe('MatchLifecycleService', () => {
  const prisma = {
    match: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  let service: MatchLifecycleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MatchLifecycleService(prisma as never);
  });

  it('reports picks as open before the first kickoff', async () => {
    prisma.match.findFirst.mockResolvedValue({
      id: 1,
      date: new Date('2026-06-20T18:00:00.000Z'),
      externalStatus: 'SCHEDULED',
      homeGoals: null,
      awayGoals: null,
    });

    await expect(
      service.getTournamentStatus(new Date('2026-06-20T17:00:00.000Z')),
    ).resolves.toEqual({
      picksLocked: false,
      firstMatchDate: '2026-06-20T18:00:00.000Z',
      firstMatchId: 1,
    });
  });

  it('locks tournament picks after the first kickoff', async () => {
    prisma.match.findFirst.mockResolvedValue({
      id: 1,
      date: new Date('2026-06-20T18:00:00.000Z'),
      externalStatus: 'IN_PLAY',
      homeGoals: 0,
      awayGoals: 0,
    });

    await expect(service.ensureTournamentPicksOpen()).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('locks predictions for a started match', async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: 9,
      date: new Date('2026-06-21T18:00:00.000Z'),
      externalStatus: 'IN_PLAY',
      homeGoals: 1,
      awayGoals: 0,
    });

    await expect(
      service.ensureMatchOpenForPredictions(9),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows predictions before kickoff', async () => {
    prisma.match.findUnique.mockResolvedValue({
      id: 9,
      date: new Date('2026-06-21T18:00:00.000Z'),
      externalStatus: 'SCHEDULED',
      homeGoals: null,
      awayGoals: null,
    });

    await expect(
      service.ensureMatchOpenForPredictions(
        9,
        new Date('2026-06-21T17:00:00.000Z'),
      ),
    ).resolves.toBeUndefined();
  });
});
