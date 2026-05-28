import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

export type CurrentUserData = {
  id: number;
  email: string;
  role: Role;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserData | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: CurrentUserData }>();
    return request.user;
  },
);
