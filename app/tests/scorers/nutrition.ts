// Scorer for the nutrition-estimator agent.
//
// WHAT A SCORER IS — a tiny pure function that takes the dataset row's
// output + expected and returns a score in [0, 1]. Braintrust runs it for
// every row of every experiment and shows you the scores per row and
// aggregated in the UI.
//
// A scorer can return a single number (score in [0,1]) or an array of named
// scores. We return an array here because we want to see per-nutrient
// accuracy, not a single blended number — "protein is great but sugar is
// way off" is a more actionable finding than "you got 0.67."
//
// WHY BINARY BUCKETS INSTEAD OF CONTINUOUS — this is from Hamel Husain's
// eval playbook (see feedback_eval_methodology memory). A continuous score
// like "1 - pctError" looks clean in a chart but obscures the question
// that actually matters: "which rows failed?" Binary buckets (1 = pass,
// 0.5 = warning, 0 = fail) make failures visible at a glance in the
// Braintrust row table.
//
// The cutoffs below match spec's "directional within 15%" rule for the
// aggregate and 25% per-item tolerance from golden-tj.json.

type Nutrition = { protein_g: number; cal: number; added_sugar_g: number };

function pctDiff(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : 1;
  return Math.abs(a - b) / b;
}

function bucket(diff: number): number {
  if (diff <= 0.15) return 1;     // PASS — within spec tolerance
  if (diff <= 0.25) return 0.5;   // WARN — noticeable but tolerable
  return 0;                        // FAIL — estimator is materially wrong
}

type ScorerArgs = {
  output: Nutrition | { items: Nutrition[] } | unknown;
  expected: Nutrition;
};

// Extract the single item from whatever shape the task returned.
// estimateNutrition returns NutritionItem[] — we're scoring one row at a time
// so we pull index 0. If you change the dataset to multi-item rows you'd
// aggregate here.
function singleItem(output: unknown): Nutrition {
  if (!output || typeof output !== "object") {
    return { protein_g: 0, cal: 0, added_sugar_g: 0 };
  }
  const o = output as Record<string, unknown>;
  if (Array.isArray(o)) {
    return (o[0] ?? {}) as Nutrition;
  }
  if ("protein_g" in o) return o as unknown as Nutrition;
  return { protein_g: 0, cal: 0, added_sugar_g: 0 };
}

export function nutritionAccuracy(args: ScorerArgs) {
  const out = singleItem(args.output);
  const exp = args.expected;

  const dProtein = pctDiff(out.protein_g, exp.protein_g);
  const dCal = pctDiff(out.cal, exp.cal);
  const dSugar = pctDiff(out.added_sugar_g, exp.added_sugar_g);

  // Returning an array of named scores makes each nutrient its own column
  // in the Braintrust UI. Protein regressions won't hide behind good calorie
  // scores, and you can sort rows by any one of them to find the worst.
  return [
    { name: "protein", score: bucket(dProtein) },
    { name: "calories", score: bucket(dCal) },
    { name: "added_sugar", score: bucket(dSugar) },
  ];
}
