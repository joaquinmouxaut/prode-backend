import { Role } from '@prisma/client';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

export type JwtUserPayload = {
  sub: number;
  email: string;
  role: Role;
};
