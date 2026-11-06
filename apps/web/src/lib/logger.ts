// Frontend logger. Configurable via NEXT_PUBLIC_LOG_LEVEL (inlined at
// build time). The default is `warn` in prod (set by env/client.ts).
//
// Level order: debug < info < warn < error. The logger drops messages
// strictly below the configured threshold. So `warn` keeps warn + error,
// `info` keeps info + warn + error, etc.
//
// In dev the format is a single console call with a `[app/<level>]`
// prefix so the dev console is greppable and a future prod log shipper
// (Sentry, Highlight, etc.) can filter by string.
//
// No server-side imports — this module ships to the browser and must
// stay client-safe. Build-time env is the only knob here.

/** biome-ignore-all lint/suspicious/noConsole: 'This is the Logger file' */
import { env } from './env/client';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const resolvedLevel: Level = env.NEXT_PUBLIC_LOG_LEVEL;

const threshold = LEVEL_RANK[resolvedLevel];

function emit(level: Level, args: unknown[]) {
  if (LEVEL_RANK[level] < threshold) return;
  const consoleFn = console[level] ?? console.log;
  consoleFn(`[app/${level}]`, ...args);
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};

export const log = logger;
