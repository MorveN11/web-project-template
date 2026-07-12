// Client-exposed env (NEXT_PUBLIC_* only). t3-oss rejects any non-NEXT_PUBLIC
// var here at build time, and it ships to the browser — keep secrets out.

import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  client: {
    NEXT_PUBLIC_API_URL: z.url().default('http://localhost:4000'),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'CLERK publishable key is required'),
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/auth/iniciar-sesion'),
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/auth/registro'),
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z.string().default('/'),
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: z.string().default('/'),
  },
  runtimeEnv: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    NEXT_PUBLIC_CLERK_SIGN_IN_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL,
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL,
  },
  emptyStringAsUndefined: true,
});
