/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone', // PM2 için standalone build
  transpilePackages: [
    '@refinedev/core',
    '@refinedev/nextjs-router',
    '@refinedev/antd',
    '@refinedev/simple-rest',
    'antd'
  ],
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://api.kadinatlasi.com'
        : 'http://localhost:4000'),
    NEXT_PUBLIC_WEB_URL:
      process.env.NEXT_PUBLIC_WEB_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://kadinatlasi.com'
        : 'http://localhost:3000'),
  },
}

module.exports = nextConfig
