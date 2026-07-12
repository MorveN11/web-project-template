// Frontend logger. Runs only in development (Next.js inlines
/** biome-ignore-all lint/suspicious/noConsole: 'This is the Logger file' */
// NODE_ENV at build time, so prod bundles get a noop).
// In prod we strip ALL logs — debug events carry input shapes that
// shouldn't ship to the browser.

import { isDev } from './env/server';

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, args: unknown[]) {
  if (!isDev) return;
  // Single prefix keeps the dev console greppable and lets any prod
  // error-tracking (Sentry, Highlight, etc.) filter by string.
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
