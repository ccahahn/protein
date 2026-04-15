// Seed Braintrust datasets from local fixture files. Run once per fixture
// change with: `npm run eval:seed`.
//
// WHY DATASETS EXIST — this is the Braintrust concept that took me longest
// to understand, so here's the one-liner: a Dataset is a named collection
// of {input, expected} pairs you can score against. Logs are a firehose of
// "what happened in production." Datasets are "the test cases I care about,
// held constant across prompt changes." You promote interesting logs INTO
// datasets; you never run evals against raw logs.
//
// This script creates two datasets:
//
//   1. "nutrition-golden-tj" — hand-verified TJ's cart from
//      /thinking/golden-test-manual.md. Each row has expected nutrition
//      numbers the estimator agent should roughly match.
//
//   2. "readout-scenarios" — synthetic ReadoutInput fixtures for the
//      readout-writer. These don't have a single correct output (text is
//      subjective) — instead the scorers check rules against whatever the
//      agent writes.

import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { initDataset } from "braintrust";

config({ path: path.join(process.cwd(), ".env.local") });

const PROJECT = "Protein";

type GoldenItem = {
  on_receipt: string;
  name: string;
  qty: number;
  protein_g: number;
  cal: number;
  added_sugar_g: number;
};

async function seedNutritionGolden() {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "tests/fixtures/golden-tj.json"),
    "utf8"
  );
  const fx = JSON.parse(raw) as {
    store: string;
    items: GoldenItem[];
  };

  const dataset = initDataset(PROJECT, {
    dataset: "nutrition-golden-tj",
    description:
      "Hand-verified Trader Joe's receipt from golden-test-manual.md. 18 food items.",
  });

  // Clear existing rows so re-running this script is idempotent. Not strictly
  // necessary — Braintrust dedupes on id — but keeps the dataset clean.
  const existing = await dataset.fetchedData();
  for (const row of existing) {
    if (row.id) dataset.delete(row.id);
  }

  let i = 0;
  for (const item of fx.items) {
    dataset.insert({
      // `input` is what gets passed to the task function during Eval.
      // Shape matches what `estimateNutrition(store, items)` expects, one
      // item at a time so we can score per-item.
      input: {
        store: fx.store,
        items: [{ name: item.name, qty: item.qty }],
      },
      // `expected` is the ground truth. The scorer compares output against
      // this per nutrient.
      expected: {
        protein_g: item.protein_g,
        cal: item.cal,
        added_sugar_g: item.added_sugar_g,
      },
      // Metadata is for humans reading the Braintrust UI. Not used by
      // scorers, but shows up on each row so you can see "oh, this was
      // line 11 of the receipt, the cocoa puffs."
      metadata: {
        source_line: ++i,
        on_receipt: item.on_receipt,
      },
    });
  }

  await dataset.flush();
  console.log(`✓ seeded nutrition-golden-tj: ${fx.items.length} rows`);
}

async function seedReadoutScenarios() {
  const dataset = initDataset(PROJECT, {
    dataset: "readout-scenarios",
    description:
      "Synthetic ReadoutInput fixtures for testing the readout-writer's rule compliance. No 'expected' output — scorers check the agent's text against rules.",
  });

  const existing = await dataset.fetchedData();
  for (const row of existing) {
    if (row.id) dataset.delete(row.id);
  }

  // Each row is a full ReadoutInput. The task runs writeReadout() on it;
  // scorers inspect the output for rule compliance.
  const scenarios = [
    {
      name: "protein_short_sugar_over",
      input: {
        family: [
          { name: "Werner", age: 43, protein_target: 65, cal_target: 2400, sugar_target: 36 },
          { name: "Cecilia", age: 34, protein_target: 49, cal_target: 1800, sugar_target: 25 },
        ],
        days: 5,
        totals: { protein_g: 400, cal: 12000, added_sugar_g: 180 },
        per_nutrient_runway: {
          protein: { days_covered: 3, status: "short" as const },
          calories: { days_covered: 5, status: "ok" as const },
          sugar: { days_covered: 6, status: "over" as const },
        },
        subtitle: "2 people · 5 days · Trader Joe's",
        best_pick_candidates: [
          { item: "Organic Chicken Thighs", protein_g: 109, added_sugar_g: 0, cal: 979 },
          { item: "Salmon Fillet", protein_g: 69, added_sugar_g: 0, cal: 664 },
          { item: "Family Meat Lasagna", protein_g: 92, added_sugar_g: 4, cal: 1240 },
          { item: "Ground Turkey", protein_g: 95, added_sugar_g: 0, cal: 750 },
        ],
        sugar_hiding: [
          { item: "Cocoa & PB Puffs", added_sugar_g: 77, protein_g: 21, cal: 1120 },
          { item: "Hamburger Buns", added_sugar_g: 32, protein_g: 32, cal: 1120 },
        ],
        low_confidence_items: [],
        store: "Trader Joe's",
      },
    },
    {
      name: "everything_ok",
      input: {
        family: [{ name: "Cecilia", age: 34, protein_target: 49, cal_target: 1800, sugar_target: 25 }],
        days: 3,
        totals: { protein_g: 200, cal: 5400, added_sugar_g: 40 },
        per_nutrient_runway: {
          protein: { days_covered: 4, status: "ok" as const },
          calories: { days_covered: 3, status: "ok" as const },
          sugar: { days_covered: 2, status: "ok" as const },
        },
        subtitle: "1 person · 3 days · Trader Joe's",
        best_pick_candidates: [
          { item: "Salmon Fillet", protein_g: 69, added_sugar_g: 0, cal: 664 },
          { item: "Greek Yogurt", protein_g: 40, added_sugar_g: 0, cal: 320 },
        ],
        sugar_hiding: [],
        low_confidence_items: [],
        store: "Trader Joe's",
      },
    },
    {
      name: "only_sugar_over",
      input: {
        family: [{ name: "Cecilia", age: 34, protein_target: 49, cal_target: 1800, sugar_target: 25 }],
        days: 5,
        totals: { protein_g: 300, cal: 9000, added_sugar_g: 180 },
        per_nutrient_runway: {
          protein: { days_covered: 6, status: "ok" as const },
          calories: { days_covered: 5, status: "ok" as const },
          sugar: { days_covered: 7, status: "over" as const },
        },
        subtitle: "1 person · 5 days · Trader Joe's",
        best_pick_candidates: [
          { item: "Chicken Breast", protein_g: 100, added_sugar_g: 0, cal: 660 },
        ],
        sugar_hiding: [
          { item: "Orange Juice (2 cartons)", added_sugar_g: 176, protein_g: 4, cal: 880 },
        ],
        low_confidence_items: [],
        store: "Trader Joe's",
      },
    },
    {
      name: "only_protein_short",
      input: {
        family: [{ name: "Werner", age: 43, protein_target: 65, cal_target: 2400, sugar_target: 36 }],
        days: 5,
        totals: { protein_g: 150, cal: 12000, added_sugar_g: 20 },
        per_nutrient_runway: {
          protein: { days_covered: 2, status: "short" as const },
          calories: { days_covered: 5, status: "ok" as const },
          sugar: { days_covered: 1, status: "ok" as const },
        },
        subtitle: "1 person · 5 days · Trader Joe's",
        best_pick_candidates: [
          { item: "Chicken Meatballs", protein_g: 64, added_sugar_g: 0, cal: 600 },
          { item: "Eggs (dozen)", protein_g: 72, added_sugar_g: 0, cal: 840 },
        ],
        sugar_hiding: [],
        low_confidence_items: [],
        store: "Trader Joe's",
      },
    },
  ];

  for (const s of scenarios) {
    dataset.insert({
      input: s.input,
      // No 'expected' — the rule scorers read the agent's output directly.
      // We still pass metadata so Braintrust UI shows the scenario name.
      metadata: { scenario: s.name },
    });
  }
  await dataset.flush();
  console.log(`✓ seeded readout-scenarios: ${scenarios.length} rows`);
}

async function main() {
  if (!process.env.BRAINTRUST_API_KEY) {
    console.error("BRAINTRUST_API_KEY not set — check .env.local");
    process.exit(1);
  }
  await seedNutritionGolden();
  await seedReadoutScenarios();
  console.log("\nDone. Open Braintrust → Protein → Library → Datasets to verify.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
