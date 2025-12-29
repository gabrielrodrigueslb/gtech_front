import withPWA from 'next-pwa'

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  turbopack: {},
}

export default withPWA({
  ...nextConfig,
  dest: 'public',
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})