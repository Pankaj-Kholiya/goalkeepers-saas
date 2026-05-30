import type { NextConfig } from 'next'
import path from 'node:path'

const nextConfig: NextConfig = {
  // Pin the workspace root to THIS project. Without it, Next walks up
  // and finds a stray lockfile in the parent dir (I:/Dev Prayaas) and
  // mis-infers the root, which breaks output tracing on deploy.
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
