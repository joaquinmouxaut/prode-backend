import { AuthUser } from '../auth.types';

export class AuthResponseDto {
  user!: AuthUser;
  accessToken!: string;
}
