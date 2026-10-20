import type { RecipeSrc } from "./define";
import { KETTLE } from "./recipes-kettle";
import { NOCOOK } from "./recipes-nocook";
import { PLATE_BREAKFAST } from "./recipes-plate-breakfast";
import { PLATE_INDIAN } from "./recipes-plate-indian";
import { PLATE_GLOBAL } from "./recipes-plate-global";
import { PLATE_SNACKS } from "./recipes-plate-snacks";

export const ALL_RECIPES: RecipeSrc[] = [
  ...KETTLE,
  ...NOCOOK,
  ...PLATE_BREAKFAST,
  ...PLATE_INDIAN,
  ...PLATE_GLOBAL,
  ...PLATE_SNACKS,
];
