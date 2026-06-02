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
}

export default nextConfig
