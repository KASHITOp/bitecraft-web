/**
 * Thin bridge to Capacitor plugins. Everything is loaded lazily and only inside
 * the Android app, so the web build never pays for it and never calls it.
 */
import { Capacitor } from "@capacitor/core";

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** Header colours from globals.css (--bg in each theme). */
const BAR = { light: "#eef0ec", dark: "#141917" } as const;

export async function setStatusBar(dark: boolean): Promise<void> {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: dark ? BAR.dark : BAR.light });
    // Style.Dark = light icons for a dark bar, Style.Light = dark icons for a light bar.
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
  } catch {
    /* plugin missing or not supported on this Android version */
  }
}

/**
 * Hardware back button: go back a screen; on the home tab, leave the app.
 * Returns a cleanup function.
 */
export async function onBackButton(getPath: () => string, goBack: () => void): Promise<() => void> {
  if (!isNative()) return () => {};
  try {
    const { App } = await import("@capacitor/app");
    const handle = await App.addListener("backButton", ({ canGoBack }) => {
      const path = getPath().replace(/\/+$/, "") || "/";
      if (path === "/" || !canGoBack) void App.exitApp();
      else goBack();
    });
    return () => void handle.remove();
  } catch {
    return () => {};
  }
}

export async function hideSplash(): Promise<void> {
  if (!isNative()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: 200 });
  } catch {
    /* ignore */
  }
}

/** Keep the screen on in cook mode. Returns false on the web so callers can fall back. */
export async function keepAwake(on: boolean): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { KeepAwake } = await import("@capacitor-community/keep-awake");
    if (on) await KeepAwake.keepAwake();
    else await KeepAwake.allowSleep();
    return true;
  } catch {
    return false;
  }
}

/** Timer finished: a strong buzz on the phone. Returns false on the web. */
export async function timerBuzz(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Warning });
    await Haptics.vibrate({ duration: 700 });
    return true;
  } catch {
    return false;
  }
}
