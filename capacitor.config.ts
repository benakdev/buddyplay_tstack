import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.buddyplay.app',
  appName: 'buddyplay_tstack',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
    allowNavigation: [
      '*.clerk.accounts.dev',
      'clerk.shared.lcl.dev',
      '*.clerk.com',
      '*.accounts.dev',
      '*.google.com',
      '*.googleapis.com',
      'accounts.google.com'
    ]
  }
};

export default config;
