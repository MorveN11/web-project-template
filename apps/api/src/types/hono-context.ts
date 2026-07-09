// Hono context variable augmentation. Defines what `c.set(key, value)` and
// `c.get(key)` accept beyond Hono's built-in defaults. Without this, every
// `c.set('log', ...)` raises TS2769 ("No overload matches this call") because
// Hono types the key as `never`.

import type { Logger } from 'pino';

declare module 'hono' {
  interface ContextVariableMap {
    log: Logger;
    request_id: string;
  }
}

// Allow this file to be imported as a side-effect module that registers the
// augmentation. Importing it once from index.ts is enough to expand the
// `Context` shape for the whole api package.
export {};