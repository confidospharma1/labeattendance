import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */

// BUILD_TARGET=apk produces a static export in ./out for Capacitor (Android app).
const isApk = process.env.BUILD_TARGET === 'apk';

const nextConfig = {
  reactStrictMode: true,
  ...(isApk
    ? { output: 'export', images: { unoptimized: true } }
    : {
        output: process.env.STANDALONE === 'true' ? 'standalone' : undefined,
        async headers() {
          return [
            {
              source: '/(.*)',
              headers: [
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self)' },
              ],
            },
          ];
        },
      }),
  env: {
    NEXT_PUBLIC_APP_NAME: 'LABE Attendance',
  },
  webpack(config) {
    // The face library is browser-only; always use its self-contained ESM build (never the tfjs-node build).
    config.resolve.alias['@vladmandic/human$'] = path.join(__dirname, 'node_modules/@vladmandic/human/dist/human.esm.js');
    return config;
  },
};

export default nextConfig;
