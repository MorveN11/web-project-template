// GlitchTip / Sentry tunnel endpoint.
//
// The Sentry browser SDK sends events to the configured DSN by default.
// We point it at `/api/glitchtip-tunnel` instead so the request lands
// on our own origin first — bypasses ad-blockers (which block the
// literal string "glitchtip" or "sentry") and avoids leaking the DSN
// hostname in the browser network tab.
//
// The handler is a thin proxy: forward the raw envelope body to
// `${dsn.protocol}//${dsn.host}/api/${projectId}/envelope/` (Sentry's
// envelope ingestion endpoint). Return 200 on any GlitchTip response
// so the SDK doesn't retry.

import { NextResponse } from 'next/server';
import { env as clientEnv } from '@/lib/env/client';

const SENTRY_ENVELOPE_PATH = (projectId: string) => `/api/${projectId}/envelope/`;

export async function POST(request: Request): Promise<NextResponse> {
  // Server route — uses `clientEnv` for NEXT_PUBLIC_SENTRY_DSN since
  // t3-oss keeps NEXT_PUBLIC_* in the client schema only. Next.js
  // inlines the value at build time so the server bundle reads it.
  const dsnString = clientEnv.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsnString) {
    // Sentry not configured — silent 200 so the SDK doesn't retry.
    return NextResponse.json({ status: 'disabled' }, { status: 200 });
  }

  let dsn: URL;
  try {
    dsn = new URL(dsnString);
  } catch {
    return NextResponse.json({ status: 'invalid_dsn' }, { status: 200 });
  }

  const projectId = dsn.pathname.replace(/^\//, '');
  const ingestUrl = `${dsn.protocol}//${dsn.host}${SENTRY_ENVELOPE_PATH(projectId)}`;

  try {
    const body = await request.text();
    const upstream = await fetch(ingestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
    });
    // Always 200 — the SDK interprets any non-2xx as a retryable
    // failure. GlitchTip's own 4xx (bad envelope) shouldn't loop.
    return NextResponse.json({ status: upstream.ok ? 'ok' : 'upstream_error' }, { status: 200 });
  } catch {
    return NextResponse.json({ status: 'tunnel_error' }, { status: 200 });
  }
}
