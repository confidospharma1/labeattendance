// Builds the static web bundle for the Android app and syncs it into the Capacitor project.
// Usage: npm run build:apk -- --api=https://your-server/api/v1
const { execSync } = require('child_process');

const arg = process.argv.find((a) => a.startsWith('--api='));
const api = arg ? arg.slice('--api='.length) : process.env.APK_API_URL;
if (!api) {
  console.error('Missing API URL. Example: npm run build:apk -- --api=http://10.0.2.2:5000/api/v1');
  process.exit(1);
}

const env = { ...process.env, BUILD_TARGET: 'apk', NEXT_PUBLIC_API_URL: api };
console.log(`Building APK web bundle against ${api}`);
execSync('node scripts/copy-face-models.js', { stdio: 'inherit', env });
execSync('npx next build', { stdio: 'inherit', env });
execSync('npx cap sync android', { stdio: 'inherit', env });
