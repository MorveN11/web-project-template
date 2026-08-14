// Frontend logger. Configurable via NEXT_PUBLIC_LOG_LEVEL (inlined at
// build time). The default is `warn` in prod (set by env/client.ts)
// and `debug` locally when the dev override is in place — env/client.ts
// reads NODE_ENV at build time, so dev defaults to debug if you unset
// the var.
//
// Level order: debug < info < warn < error. The logger drops messages
// strictly below the configured threshold. So `warn` keeps warn + error,
// `info` keeps info + warn + error, etc.
//
// In dev the format is a single console call with a `[app/<level>]`
// prefix so the dev console is greppable and a future prod log shipper
// (Sentry, Highlight, etc.) can filter by string.

/** biome-ignore-all lint/suspicious/noConsole: 'This is the Logger file' */
import { env } from './env/client';
import { isDev } from './env/server';

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Resolve the threshold once at module load. Dev defaults to debug
// when the var isn't set; env/client.ts already applies the prod
// default of warn at build time, so this is just a belt-and-braces
// fallback for tests or unusual build configs.
const resolvedLevel: Level = (env.NEXT_PUBLIC_LOG_LEVEL as Level) ?? (isDev ? 'debug' : 'warn');

const threshold = LEVEL_RANK[resolvedLevel];

function emit(level: Level, args: unknown[]) {
  if (LEVEL_RANK[level] < threshold) return;
  const consoleFn = console[level] ?? console.log;
  // Single prefix keeps dev console greppable; production log
  // shippers can filter by `[app/...]` string.
  consoleFn(`[app/${level}]`, ...args);
}

export const logger = {
  debug: (...args: unknown[]) => emit('debug', args),
  info: (...args: unknown[]) => emit('info', args),
  warn: (...args: unknown[]) => emit('warn', args),
  error: (...args: unknown[]) => emit('error', args),
};

export const log = logger;
