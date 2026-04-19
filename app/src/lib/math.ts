import type { NutritionItem, Totals } from "./types";

export function sumTotals(items: NutritionItem[]): Totals {
  return items.reduce<Totals>(
    (a, i) => ({
      protein_g: a.protein_g + i.protein_g,
      cal: a.cal + i.cal,
      added_sugar_g: a.added_sugar_g + i.added_sugar_g,
    }),
    { protein_g: 0, cal: 0, added_sugar_g: 0 }
  );
}

export function subtitleFor(opts: {
  itemCount: number;
  store: string;
  servings?: number;
}): string {
  const { itemCount, store, servings } = opts;
  const itemLabel = itemCount === 1 ? "1 item" : `${itemCount} items`;
  const base = `${itemLabel} from ${store}`;
  if (typeof servings === "number" && servings > 1) {
    return `${base} · serves ${servings}`;
  }
  return base;
}

// Best pick CANDIDATES — server filters and ranks, but doesn't pick the
// final 3. The agent gets up to 8 candidates and picks which 3 to feature.
export function pickBestPickCandidates(items: NutritionItem[]): NutritionItem[] {
  return [...items]
    .filter((it) => it.protein_g >= 10 && it.added_sugar_g < 10)
    .sort((a, b) => {
      if (b.protein_g !== a.protein_g) return b.protein_g - a.protein_g;
      return a.added_sugar_g - b.added_sugar_g;
    })
    .slice(0, 8);
}

// Top 3 added-sugar contributors. Items must clear 10g to show up — anything
// under that is too noisy to call out as "hiding sugar." When nothing clears
// the bar, returns []; the readout omits the section and the agent's headline
// covers the clean-cart case.
export function pickSugarHiding(items: NutritionItem[]): NutritionItem[] {
  return [...items]
    .filter((it) => it.added_sugar_g >= 10)
    .sort((a, b) => b.added_sugar_g - a.added_sugar_g)
    .slice(0, 3);
}

export function lowConfidenceItems(
  items: NutritionItem[]
): { item: string; reason: string }[] {
  return items
    .filter((i) => i.confidence !== "high")
    .map((i) => ({
      item: i.name,
      reason: i.reasoning ?? `${i.confidence} confidence`,
    }));
}
