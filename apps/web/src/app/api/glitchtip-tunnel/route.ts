// GlitchTip / Sentry tunnel endpoint.
//
// The Sentry browser SDK sends events to the configured DSN by default.
// We point it at `/api/glitchtip-tunnel` instead so the request lands
// on our own origin first — bypasses ad-blockers (which block the
// literal string "glitchtip" or "sentry") and avoids leaking the DSN
// hostname in the browser network tab.
//
// The handler is a thin proxy: forward the raw envelope body to
// `${dsn.protocol}//${dsn.host}/api/${projectId}/envelope/${dsn.search}`
// (Sentry's envelope ingestion endpoint — note the DSN's search string
// carries `sentry_key` + `sentry_version`, dropping it makes GlitchTip
// 403 silently). Return 200 on any GlitchTip response so the SDK
// doesn't retry.

import { NextResponse } from 'next/server';
import { env as clientEnv } from '@/lib/env/client';

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
  // ponytail: preserve dsn.search — Sentry SDK packs sentry_key + sentry_version
  // there. Stripping it makes GlitchTip 4xx silently.
  const ingestUrl = `${dsn.protocol}//${dsn.host}/api/${projectId}/envelope/${dsn.search}`;

  // Inbound auth header (some Sentry SDK versions send it). Forward when present.
  const sentryAuth = request.headers.get('x-sentry-auth');

  try {
    const body = await request.text();
    const upstream = await fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        ...(sentryAuth ? { 'X-Sentry-Auth': sentryAuth } : {}),
      },
      body,
    });
    // Always 200 — the SDK interprets any non-2xx as a retryable
    // failure. GlitchTip's own 4xx (bad envelope) shouldn't loop.
    return NextResponse.json({ status: upstream.ok ? 'ok' : 'upstream_error' }, { status: 200 });
  } catch {
    return NextResponse.json({ status: 'tunnel_error' }, { status: 200 });
  }
}
