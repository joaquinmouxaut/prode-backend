import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skips global JWT guard (e.g. register/login). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
