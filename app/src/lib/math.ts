import type {
  NutritionItem,
  PantryItem,
  PerNutrientRunway,
  Targets,
  TopOffender,
  Totals,
  NutrientStatus,
} from "./types";

type AnyItem = (NutritionItem | PantryItem) & { qty?: number };

export function sumTotals(items: AnyItem[]): Totals {
  return items.reduce<Totals>(
    (a, i) => ({
      protein_g: a.protein_g + i.protein_g,
      cal: a.cal + i.cal,
      added_sugar_g: a.added_sugar_g + i.added_sugar_g,
    }),
    { protein_g: 0, cal: 0, added_sugar_g: 0 }
  );
}

export function combine(a: Totals, b: Totals): Totals {
  return {
    protein_g: a.protein_g + b.protein_g,
    cal: a.cal + b.cal,
    added_sugar_g: a.added_sugar_g + b.added_sugar_g,
  };
}

function wholeDays(n: number): number {
  return Math.round(n);
}

// Protein is a floor — flag when you're short.
function proteinStatus(days_covered: number, target_days: number): NutrientStatus {
  return days_covered >= target_days ? "ok" : "short";
}
// Calories are treated as a soft ceiling — we never tell the user to eat more.
// Only flag when the haul is notably over the family's weekly energy need.
function caloriesStatus(days_covered: number, target_days: number): NutrientStatus {
  return days_covered > target_days * 1.1 ? "over" : "ok";
}
// Added sugar is a ceiling — flag when you're over.
function sugarStatus(days_covered: number, target_days: number): NutrientStatus {
  return days_covered <= target_days * 1.05 ? "ok" : "over";
}

export function perNutrientRunway(
  totals: Totals,
  familyDaily: Targets,
  days: number
): PerNutrientRunway {
  const p = wholeDays(totals.protein_g / Math.max(1, familyDaily.protein_g));
  const c = wholeDays(totals.cal / Math.max(1, familyDaily.cal));
  const s = wholeDays(totals.added_sugar_g / Math.max(1, familyDaily.added_sugar_g));
  return {
    protein: { days_covered: p, status: proteinStatus(p, days) },
    calories: { days_covered: c, status: caloriesStatus(c, days) },
    sugar: { days_covered: s, status: sugarStatus(s, days) },
  };
}

function sortByContribution(
  items: AnyItem[],
  key: "protein_g" | "cal" | "added_sugar_g"
): AnyItem[] {
  return [...items]
    .filter((i) => i[key] > 0)
    .sort((a, b) => {
      if (b[key] !== a[key]) return b[key] - a[key];
      const aq = a.qty ?? 1;
      const bq = b.qty ?? 1;
      if (bq !== aq) return bq - aq;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 2);
}

export function topOffenders(
  items: AnyItem[],
  runway: PerNutrientRunway
): TopOffender[] {
  const out: TopOffender[] = [];

  if (runway.sugar.status === "over") {
    for (const it of sortByContribution(items, "added_sugar_g")) {
      out.push({
        item: it.name,
        nutrient: "sugar",
        contribution_g_or_cal: Math.round(it.added_sugar_g),
        direction: "overage",
      });
    }
  }
  if (runway.protein.status === "short") {
    for (const it of sortByContribution(items, "protein_g")) {
      out.push({
        item: it.name,
        nutrient: "protein",
        contribution_g_or_cal: Math.round(it.protein_g),
        direction: "shortfall",
      });
    }
  }
  // Calories: we don't suggest anything. No offenders emitted for calories.
  return out;
}

export function dayLabelProtein(days_covered: number, target: number): string {
  if (days_covered >= target) return `Covers the full ${target}`;
  const short = target - days_covered;
  return `${days_covered} of ${target} days — short by ${short}`;
}
export function dayLabelCalories(days_covered: number, target: number): string {
  if (days_covered >= target) return `Covers the full ${target}`;
  const short = target - days_covered;
  if (short <= 1) return `${days_covered} of ${target} days — almost there`;
  return `${days_covered} of ${target} days — short by ${short}`;
}
export function dayLabelSugar(days_covered: number, target: number): string {
  if (days_covered <= target) return `${days_covered} of ${target} days of added sugar — under`;
  const over = days_covered - target;
  return `${days_covered} days of added sugar in a ${target}-day shop — over by ${over}`;
}

export function subtitleFor(opts: {
  peopleCount: number;
  days: number;
  store: string;
  hasPantry: boolean;
}): string {
  const { peopleCount, days, store, hasPantry } = opts;
  const storeBit = hasPantry ? `${store} + pantry` : store;
  const peopleLabel = peopleCount === 1 ? "1 person" : `${peopleCount} people`;
  const dayLabel = days === 1 ? "1 day" : `${days} days`;
  return `${peopleLabel} · ${dayLabel} · ${storeBit} · USDA DRI + AHA`;
}

// For a protein-short cart, find the best pick that closes the gap with the
// fewest additional units, and produce a deterministic "Add N more for X/Y days."
// string. Returns the winning item name + the text. Returns null if protein is
// already covered or no candidate can be found.
export function proteinGapCloser(
  picks: { name: string; qty: number; protein_g: number }[],
  totals_protein_g: number,
  family_daily_protein_g: number,
  days: number,
  protein_status: NutrientStatus
): {
  item: string;
  short_by_g: number;
  action_text: string;
} | null {
  if (protein_status !== "short") return null;
  const need = family_daily_protein_g * days;
  const gap = need - totals_protein_g;
  if (gap <= 0) return null;

  let winner: { item: string; units: number; per_unit: number } | null = null;
  for (const p of picks) {
    const qty = Math.max(1, p.qty);
    const per_unit = p.protein_g / qty;
    if (per_unit <= 0) continue;
    const units = Math.ceil(gap / per_unit);
    if (!winner || units < winner.units) {
      winner = { item: p.name, units, per_unit };
    }
  }
  if (!winner) return null;

  const new_total = totals_protein_g + winner.per_unit * winner.units;
  const new_days = Math.round(new_total / Math.max(1, family_daily_protein_g));
  const unitWord = winner.units === 1 ? "1 more" : `${winner.units} more`;
  return {
    item: winner.item,
    short_by_g: Math.round(gap),
    action_text: `Add ${unitWord} for ${new_days}/${days} days.`,
  };
}

// Best pick CANDIDATES — server filters and ranks, but doesn't pick the
// final 3. The agent gets up to 8 candidates and picks which 3 to feature
// based on its own judgment of what's interesting. The user wants the agent
// to think about things like calorie-vs-yumminess and protein-vs-sugar
// tradeoffs without being told what to value.
export function pickBestPickCandidates(items: NutritionItem[]): NutritionItem[] {
  return [...items]
    .filter((it) => it.protein_g >= 10 && it.added_sugar_g < 10)
    .sort((a, b) => {
      if (b.protein_g !== a.protein_g) return b.protein_g - a.protein_g;
      return a.added_sugar_g - b.added_sugar_g;
    })
    .slice(0, 8);
}

// Top 3 added-sugar contributors across receipt + pantry. Threshold raised
// to >10g — anything under that is too noisy to call out as "hiding sugar."
export function pickSugarHiding(items: AnyItem[]): AnyItem[] {
  return [...items]
    .filter((it) => it.added_sugar_g > 10)
    .sort((a, b) => b.added_sugar_g - a.added_sugar_g)
    .slice(0, 3);
}

export function lowConfidenceItems(
  items: AnyItem[]
): { item: string; reason: string }[] {
  return items
    .filter((i) => i.confidence !== "high")
    .map((i) => ({
      item: i.name,
      reason: i.reasoning ?? `${i.confidence} confidence`,
    }));
}
