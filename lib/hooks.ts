"use client";

import { useMemo } from "react";
import { useProfile } from "./state";
import { targets, type Targets } from "./profile";
import type { Gear } from "./types";

const EVERYTHING: Gear[] = ["kettle", "induction", "pan", "microwave", "fridge"];

/** The gear from onboarding. Without a profile we assume a full kit. */
export function useMyGear(): Gear[] {
  const [profile] = useProfile();
  return profile?.gear ?? EVERYTHING;
}

export function useTargets(): Targets | null {
  const [profile] = useProfile();
  return useMemo(() => (profile ? targets(profile) : null), [profile]);
}
