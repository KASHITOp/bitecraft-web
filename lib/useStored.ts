"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { parse, readRaw, subscribe, write, type StoreKey } from "./storage";

const noopSubscribe = () => () => {};

/** True after the first client render. Server and hydration pass get false. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * React binding for one storage key. The server snapshot is always null,
 * so the first render matches the server and real data arrives right after.
 */
export function useStored<T>(
  key: StoreKey,
  fallback: T,
  clean?: (v: unknown) => T | null,
): [T, (next: T | ((prev: T) => T)) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
  // fallback and clean are expected to be stable (module constants).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => parse(raw, fallback, clean), [raw]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = parse(readRaw(key), fallback, clean);
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      write(key, resolved);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, set];
}
