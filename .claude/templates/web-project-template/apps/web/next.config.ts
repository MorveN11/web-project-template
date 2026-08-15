import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

// Security headers applied to every response. Layered with the api's
// `secureHeaders` middleware — defence in depth. CSP is static and
// lives in the `headers()` array below (single source of truth, covers
// `/_next/image` and every other route).
const config: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    minimumCacheTTL: 604800,
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
        port: '',
        pathname: '/**',
      },
    ],
    // CSP moved to `headers()` below — single source of truth for the whole app,
    // including the `/_next/image` optimizer endpoint.
  },
  async headers() {
    // Build-time values drive the CSP variants:
    //   - `'unsafe-eval'` only in non-prod builds (React dev uses eval
    //     for callstack reconstruction; prod React never does).
    //   - `IS_COMPOSE=true` widens `connect-src` with `localhost:*` so
    //     the browser can reach a host-side api during local dev /
    //     `pnpm compose:prod`. Release workflows inject `false`.
    //   - `apiOrigin` is derived from `NEXT_PUBLIC_API_URL` so the api
    //     is always allowlisted without per-env hardcoding. Malformed
    //     URL → fall through silently (CSP stays strict).
    const scriptSrcExtra = process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'";
    const isCompose = process.env.IS_COMPOSE === 'true';
    let apiOrigin = '';
    if (process.env.NEXT_PUBLIC_API_URL) {
      try {
        apiOrigin = ` ${new URL(process.env.NEXT_PUBLIC_API_URL).origin}`;
      } catch {
        // malformed URL — leave it out, CSP stays strict
      }
    }
    const connectSrcExtra =
      process.env.NODE_ENV === 'production' && !isCompose ? '' : ' http://localhost:* ws://localhost:*';

    // Static CSP — same for every visitor, CDN-cacheable. No nonce: Umami
    // loads from its allowlisted origin (no inline script), JSON-LD runs
    // under `'unsafe-inline'` which is the standard pattern for Next.js apps
    // with structured data (Next's RSC hydration scripts are inline and
    // can't be nonced without per-request generation). The external-origin
    // allowlist is the real defense.
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${scriptSrcExtra} https://*.clerk.accounts.dev https://*.clerk.com https://your-umami.example.com https://static.cloudflareinsights.com https://challenges.cloudflare.com`,
      `script-src-elem 'self' 'unsafe-inline'${scriptSrcExtra} https://*.clerk.accounts.dev https://*.clerk.com https://your-umami.example.com https://static.cloudflareinsights.com https://challenges.cloudflare.com`,
      "script-src-attr 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com https://<your-clerk-proxy-host>",
      "font-src 'self' data:",
      "frame-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://<your-clerk-proxy-host> https://challenges.cloudflare.com",
      `connect-src 'self'${apiOrigin}${connectSrcExtra} https://*.clerk.accounts.dev https://*.clerk.com https://api.clerk.com https://clerk-telemetry.com https://<your-clerk-proxy-host> https://your-umami.example.com https://cloudflareinsights.com https://challenges.cloudflare.com`,
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "form-action 'self' https://*.clerk.accounts.dev https://*.clerk.com https://<your-clerk-proxy-host>",
      "base-uri 'self'",
      "object-src 'none'",
      "manifest-src 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          // HSTS — 2 years, include subdomains, eligible for preload.
          // Activated only in production (https). Browsers ignore it on
          // http://localhost, so dev stays unaffected.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Defence against MIME-type sniffing.
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // No framing at all (replaces X-Frame-Options; modern browsers
          // honour CSP frame-ancestors, but we send both for legacy).
          { key: 'X-Frame-Options', value: 'DENY' },
          // Referrer leakage control.
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Disable powerful features the app doesn't use.
          {
            key: 'Permissions-Policy',
            value:
              'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
          },
          // Cross-origin isolation. COEP requires `credentialless` for
          // any third-party iframe; safe default here.
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-site',
          },
          // Content-Security-Policy — static, single source of truth. Covers
          // `/_next/image` and every other route. See comment on `csp` above.
          {
            key: 'Content-Security-Policy',
            value: csp,
          },
        ],
      },
    ];
  },
};

// GlitchTip / Sentry wrapper. Uploads source maps at build time when
// SENTRY_AUTH_TOKEN is present (build-time only — never runtime env,
// leaks via `docker history` otherwise). The browser tunnel is wired
// to /api/glitchtip-tunnel (App Router) — see route.ts for the
// forwarding logic.
//
// `silent: !isProd` suppresses build-time source-map warnings in dev
// where there's no token to upload with.
export default withSentryConfig(config, {
  org: process.env.SENTRY_ORG,
  // Pull the project id from the DSN instead of a separate
  // `SENTRY_PROJECT` build arg — DSN format is
  // `https://<key>@<host>/<project_id>`. Falls back to `undefined`
  // in dev (no DSN), which `withSentryConfig` handles gracefully.
  project: process.env.NEXT_PUBLIC_SENTRY_DSN
    ? new URL(process.env.NEXT_PUBLIC_SENTRY_DSN).pathname.replace(/^\//, '')
    : undefined,
  // `next.config.ts` runs as a plain Node script at build time —
  // before Next.js compiles `src/`. Imports from `@/lib/env/*` would
  // fail here. `process.env.*` is the only option for build-time config.
  silent: process.env.NODE_ENV !== 'production',
  // `@sentry/nextjs` v9 dropped `hideSourceMaps` and replaced it with
  // the `sourcemaps` config object. `disable` is a hard kill switch
  // for both generation AND upload — leaving it `false` (or omitting
  // it) makes the plugin emit `.map` files during compilation and
  // upload them to GlitchTip, where the server resolves minified
  // stack frames. The standalone bundle stays map-free.
  sourcemaps: { disable: false },
  // `tunnelRoute` only affects the *browser SDK's* event submission
  // path (ad-blocker bypass via our own origin). Build-time source
  // map uploads are server-to-server and ignore this flag entirely.
  tunnelRoute: '/api/glitchtip-tunnel',
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
