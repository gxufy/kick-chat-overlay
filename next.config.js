/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['files.kick.com', 'cdn.7tv.app'],
    unoptimized: true
  }
}

module.exports = nextConfig
