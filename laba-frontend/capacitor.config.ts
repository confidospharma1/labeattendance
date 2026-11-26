import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.labe.attendance',
  appName: 'J-Track',
  webDir: 'out',
  server: {
    // http://localhost keeps camera + GPS working (localhost is a secure context) and lets the
    // app reach an http:// test server such as http://10.0.2.2:5000 (emulator -> your PC).
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
