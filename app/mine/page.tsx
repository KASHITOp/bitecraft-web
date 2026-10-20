import { Suspense } from "react";
import { Mine } from "./Mine";

export const metadata = { title: "My recipe · BiteCraft" };

export default function MinePage() {
  return (
    <Suspense>
      <Mine />
    </Suspense>
  );
}
