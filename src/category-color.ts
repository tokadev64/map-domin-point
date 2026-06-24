import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR } from "./constants.ts";

export function categoryColor(category: string): string {
  return Object.hasOwn(CATEGORY_COLORS, category)
    ? CATEGORY_COLORS[category]
    : DEFAULT_CATEGORY_COLOR;
}
