// Next.js' `redirect()` and `notFound()` short-circuit renders by
// throwing an internal error whose `digest` starts with `NEXT_REDIRECT`
// or `NEXT_NOT_FOUND`. Any try/catch that wants to handle other errors
// MUST re-throw these — otherwise the catch swallows the navigation
// signal and turns it into a silent fallback, breaking redirect's
// contract. Use this guard at the top of every catch that may wrap
// a redirect/notFound call (directly or transitively).

export function isNextControlError(err: unknown): boolean {
  return (
    err instanceof Error &&
    'digest' in err &&
    typeof (err as { digest: unknown }).digest === 'string' &&
    ((err as { digest: string }).digest.startsWith('NEXT_REDIRECT') ||
      (err as { digest: string }).digest.startsWith('NEXT_NOT_FOUND'))
  );
}
