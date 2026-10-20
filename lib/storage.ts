/**
 * The only place that touches localStorage. Every read is wrapped in
 * try/catch and falls back to a safe default, because storage can be
 * blocked (private mode), full, or hold junk from an old version.
 */

const PREFIX = "bitecraft:v1:";
const EVENT = "bitecraft-storage";

export type StoreKey =
  | "profile"
  | "onboarding"
  | "pantry"
  | "saved"
  | "chefRecipes"
  | "shopping"
  | "plan"
  | "settings"
  | "chat";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readRaw(key: StoreKey): string | null {
  const s = storage();
  if (!s) return null;
  try {
    return s.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function parse<T>(raw: string | null, fallback: T, clean?: (v: unknown) => T | null): T {
  if (raw == null) return fallback;
  try {
    const value: unknown = JSON.parse(raw);
    if (clean) return clean(value) ?? fallback;
    return (value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export function read<T>(key: StoreKey, fallback: T, clean?: (v: unknown) => T | null): T {
  return parse(readRaw(key), fallback, clean);
}

export function write<T>(key: StoreKey, value: T): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(PREFIX + key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
    return true;
  } catch {
    return false;
  }
}

export function remove(key: StoreKey): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(PREFIX + key);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
  } catch {
    /* ignore */
  }
}

export function clearAll(): void {
  const s = storage();
  if (!s) return;
  try {
    Object.keys(s)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => s.removeItem(k));
    window.dispatchEvent(new CustomEvent(EVENT, { detail: "*" }));
  } catch {
    /* ignore */
  }
}

/** Subscribe to changes from this tab and other tabs. */
export function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(PREFIX)) callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}
