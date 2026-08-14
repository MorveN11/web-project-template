// Web liveness probe. Public (lives under `(public)/`, no auth).
// Reports only process state — no DB, no api ping. The api has its own
// `/health`; monitoring hits both.
//
// `force-dynamic` keeps Next.js from caching the response — every
// request gets a fresh timestamp.

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'web',
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
