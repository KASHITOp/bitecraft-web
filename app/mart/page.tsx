import { Suspense } from "react";
import { Mart } from "./Mart";

export const metadata = { title: "Quick Mart · BiteCraft" };

export default function MartPage() {
  return (
    <Suspense>
      <Mart />
    </Suspense>
  );
}
