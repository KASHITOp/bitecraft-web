import { Suspense } from "react";
import { Cook } from "./Cook";

export const metadata = { title: "Cook mode · BiteCraft" };

export default function CookPage() {
  return (
    <Suspense>
      <Cook />
    </Suspense>
  );
}
