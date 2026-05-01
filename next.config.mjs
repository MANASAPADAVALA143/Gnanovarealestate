/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Full-repo ESLint is run separately; keeps `next build` fast on large workspaces.
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '64mb',
    },
  },
}

export default nextConfig
