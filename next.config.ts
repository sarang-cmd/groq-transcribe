import type { NextConfig } from 'next';
const nextConfig: NextConfig = { serverExternalPackages: ['jszip', '@ffmpeg-installer/ffmpeg'] };
export default nextConfig;
