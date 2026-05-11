import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.varunsonline.app',
  appName: "Varun's Online",

  // webDir is used for local fallback only.
  // In Remote URL mode the app loads the live site instead.
  webDir: 'out',

  server: {
    // ← Remote URL mode: the WebView loads your live Vercel deployment.
    //   All API routes, Supabase SSR auth, Razorpay, and maps continue
    //   to work exactly as they do on the website — zero code changes needed.
    url: 'https://www.varunsonline.com',
    cleartext: false,
    androidScheme: 'https',
  },

  android: {
    // Hardware acceleration for smooth scrolling/animations
    hardwareAccelerated: true,
    // Allow text input to be captured correctly
    captureInput: true,
    // Disable remote debugging in production (set true during testing)
    webContentsDebuggingEnabled: false,
  },

  plugins: {
    // Orange splash screen matching brand colour
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#f97316',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    // Status bar matching brand colour
    StatusBar: {
      style: 'dark',
      backgroundColor: '#f97316',
    },
    // Push Notifications via Firebase FCM
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
