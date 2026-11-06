// Prisma error-code guards. Used by services/repositories to map known
// constraint violations to typed Results without leaking the Prisma
// error shape across the codebase.

export function isUniqueViolation(cause: unknown): boolean {
  if (typeof cause !== 'object' || cause === null) return false;
  return (cause as { code?: string }).code === 'P2002';
}

export function isRecordNotFound(cause: unknown): boolean {
  if (typeof cause !== 'object' || cause === null) return false;
  return (cause as { code?: string }).code === 'P2025';
}
