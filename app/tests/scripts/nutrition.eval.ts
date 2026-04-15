// Braintrust-hosted evaluation of the nutrition-estimator agent.
//
// Run with: `npm run eval:nutrition`
//
// HOW THIS WORKS — Eval() is Braintrust's high-level API that wires together
// three things:
//
//   1. `data`  — where to pull {input, expected} rows from. We load the
//                seeded "nutrition-golden-tj" dataset (via initDataset).
//   2. `task`  — a function that takes one row's input and returns an
//                output. We call the real estimateNutrition() agent here.
//   3. `scores`— one or more scorers that grade each row's output against
//                its expected. We use nutritionAccuracy.
//
// Every Eval() run creates a new EXPERIMENT in Braintrust. Experiments are
// point-in-time snapshots: "this prompt version, run against this dataset
// version, got these scores." Two runs = two experiments = side-by-side
// comparison in the UI. That's the core loop for "is the new prompt
// actually better?"
//
// Run this with the Braintrust CLI from package.json:
//   braintrust eval tests/scripts/eval-nutrition.ts
// The CLI auto-discovers Eval() calls in the file, loads .env.local,
// handles authentication, and streams results to the Braintrust project.

import path from "node:path";
import { config } from "dotenv";
import { Eval, initDataset } from "braintrust";
import { estimateNutrition } from "../../src/lib/agents/nutrition-estimator";
import { nutritionAccuracy } from "../scorers/nutrition";

// The CLI passes --env-file in theory, but loading here too is belt-and-
// suspenders — makes `tsx` direct-run work as a fallback.
config({ path: path.join(process.cwd(), ".env.local") });

const PROJECT = "Protein";

type Input = {
  store: string;
  items: { name: string; qty: number }[];
};

Eval(PROJECT, {
  // The experiment name becomes the row in Braintrust → Experiments.
  // Including a timestamp or prompt-version hint here helps you compare
  // runs later. Braintrust will auto-suffix duplicates.
  experimentName: `nutrition-estimator-${new Date().toISOString().slice(0, 10)}`,

  // Pull rows from the seeded dataset. The dataset is version-tracked —
  // Braintrust remembers which dataset version each experiment ran on, so
  // if you add rows later, old experiments still reference the old version.
  data: initDataset(PROJECT, { dataset: "nutrition-golden-tj" }),

  // The task is the thing under test. For each dataset row, Braintrust
  // calls this function with {input}. Whatever it returns gets passed to
  // the scorer as `output`.
  //
  // We call estimateNutrition with store + a single item, and return the
  // first (only) result. The scorer compares it against the row's expected
  // nutrition values per nutrient.
  task: async (input: Input) => {
    const [enriched] = await estimateNutrition(
      input.store,
      input.items.map((it) => ({
        name: it.name,
        qty: it.qty,
        confidence: "high" as const,
      }))
    );
    return enriched;
  },

  // Scores — each function returns a score per row. You can attach
  // multiple scorers (e.g., an LLM judge in addition to the deterministic
  // one) and Braintrust shows them in separate columns.
  scores: [nutritionAccuracy],
});
