import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  // Pin the workspace root to THIS project. Without it, Next walks up
  // and finds a stray lockfile in the parent dir (I:/Dev Prayaas) and
  // mis-infers the root, which breaks output tracing on deploy.
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    // Sponsor banners are uploaded inline and stored as base64 data URLs in
    // Sponsor.logoUrl (no blob storage). A few-hundred-KB banner exceeds the
    // 1MB default server-action body limit, so raise it.
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  // Baseline security headers on every response. HSTS forces HTTPS (ignored on
  // localhost), nosniff blocks MIME sniffing, SAMEORIGIN framing stops
  // clickjacking, and the referrer/permissions policies tighten leakage. A full
  // CSP is intentionally omitted here (it needs nonce wiring for Next's inline
  // bootstrap) — track it as a follow-up.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
