import { Role } from '@prisma/client';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  championPick: string | null;
  topScorerPick: string | null;
};

export type JwtUserPayload = {
  sub: number;
  email: string;
  role: Role;
};
