import type { ZodError } from 'zod';

// First zod issue message, or a localized fallback. Caller decides
// whether to throw (inside safeAction) or return the Result shape
// directly.

export function firstZodMessage(error: ZodError, fallback = 'Invalid input.'): string {
  return error.issues[0]?.message ?? fallback;
}
