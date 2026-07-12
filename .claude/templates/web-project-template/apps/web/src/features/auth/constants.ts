// Auth-related route constants.
//
// Pulled into their own module so feature code (and tests) can
// reference the sign-in URL without importing the whole auth surface
// or hitting `env` directly. Both values come from the validated
// client env, so any typo fails fast at boot rather than at runtime.

import { env } from '@/lib/env/client';

/** Page the app redirects to when the session is missing or invalid. */
export const REDIRECT_URL = env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;

/** Page Clerk redirects to after a successful sign-in. */
export const FALLBACK_REDIRECT_URL = '/';
