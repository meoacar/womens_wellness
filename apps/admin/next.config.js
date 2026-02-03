/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone', // PM2 için standalone build
  transpilePackages: [
    '@refinedev/core',
    '@refinedev/nextjs-router',
    '@refinedev/antd',
    '@refinedev/simple-rest',
    'antd'
  ],
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000',
  },
}

module.exports = nextConfig
