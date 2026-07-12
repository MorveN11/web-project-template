// Next.js short-circuits renders and server actions by throwing
// internal errors with `digest` starting with `NEXT_REDIRECT` or
// `NEXT_NOT_FOUND`. When user code wraps an awaitable in try/catch
// (to map errors to a typed Result, log, etc.) those control errors
// must be RE-THROWN — otherwise the catch swallows the navigation
// signal and turns it into a silent `null`, breaking the
// `redirectIfNotFound: true` contract.
//
// Use this predicate in every catch that wraps code which may
// `redirect()` or `notFound()`:
//
//   try {
//     await somethingThatRedirects();
//   } catch (cause) {
//     if (isNextControlError(cause)) throw cause;
//     // …handle real errors
//   }
export function isNextControlError(err: unknown): boolean {
  return (
    err instanceof Error &&
    'digest' in err &&
    typeof (err as { digest: unknown }).digest === 'string' &&
    ((err as { digest: string }).digest.startsWith('NEXT_REDIRECT') ||
      (err as { digest: string }).digest.startsWith('NEXT_NOT_FOUND'))
  );
}