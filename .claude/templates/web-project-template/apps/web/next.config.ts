import type { NextConfig } from 'next';

// Security headers applied to every response. Layered with the api's
// `secureHeaders` middleware — defence in depth. CSP is permissive enough
// for Clerk's iframe + JS bundles; tighten in forks that don't need them.
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
    // Lock the image optimizer to self + Clerk's image CDN. Matches
    // the script-src `img-src` allowlist in the CSP below.
    contentSecurityPolicy:
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://img.clerk.com; font-src 'self' data:",
  },
  async headers() {
    // CSP is intentionally permissive for Clerk's runtime (their
    // components inject styles + iframes). Forks that don't use the
    // Clerk-hosted Account Portal can tighten frame-src to 'self'.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://clerk.web-project-template.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com",
      "font-src 'self' data:",
      // Clerk's Account Portal + WebAuthn flows live in iframes.
      "frame-src 'self' https://*.clerk.accounts.dev https://clerk.web-project-template.com https://challenges.cloudflare.com",
      "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://api.clerk.com https://clerk.web-project-template.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "form-action 'self' https://*.clerk.accounts.dev",
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
          // Content Security Policy.
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default config;
