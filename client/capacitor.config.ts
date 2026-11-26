import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.favoriteorders.app',
  appName: 'Favorite Orders',
  webDir: 'dist',
  server: {
    // Allow the WebView to reach a plain-HTTP development API (VITE_API_URL).
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      showSpinner: false,
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
};

export default config;
