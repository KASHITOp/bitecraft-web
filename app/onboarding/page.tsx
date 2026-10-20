import { Suspense } from "react";
import { Onboarding } from "./Onboarding";

export const metadata = { title: "Set up · BiteCraft" };

export default function OnboardingPage() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
