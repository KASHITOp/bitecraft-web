import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.bitecraft.app",
  appName: "BiteCraft",
  // Static export from `npm run build:mobile`.
  webDir: "out",
  backgroundColor: "#eef0ec",
  android: {
    backgroundColor: "#eef0ec",
  },
  plugins: {
    SplashScreen: {
      // Hidden by the app as soon as React mounts; this is the upper bound.
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#eef0ec",
      showSpinner: false,
      androidScaleType: "CENTER",
    },
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: "#eef0ec",
      style: "LIGHT",
    },
  },
};

export default config;
