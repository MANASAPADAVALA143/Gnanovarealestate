/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Full-repo ESLint is run separately; keeps `next build` fast on large workspaces.
    ignoreDuringBuilds: true,
  },
  // Expose Vite-style env to the Next browser bundle (Hot Leads login / apiFetch).
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '64mb',
    },
  },
}

export default nextConfig
