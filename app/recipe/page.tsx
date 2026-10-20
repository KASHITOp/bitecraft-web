import { Suspense } from "react";
import { RecipeDetail } from "./RecipeDetail";

export const metadata = { title: "Recipe · BiteCraft" };

export default function RecipePage() {
  return (
    <Suspense>
      <RecipeDetail />
    </Suspense>
  );
}
