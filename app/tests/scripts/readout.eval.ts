// Braintrust-hosted evaluation of the readout-writer agent.
//
// Run with: `npm run eval:readout`
//
// This is the same Eval() shape as eval-nutrition.ts, but with two
// key differences:
//
//   1. Each row's task runs writeReadout() on a synthetic ReadoutInput
//      we seeded in readout-scenarios. This calls the actual agent, so
//      this eval is a real end-to-end check that the prompt behaves.
//
//   2. The scorers aren't comparing output to expected numbers — they're
//      running cheap deterministic assertions against the agent's text
//      (no decimals, no day names, no calories, headline matches status,
//      etc.). These catch the "cocoa puffs advice" class of bug
//      automatically on every run.
//
// Why this is better than staring at Braintrust logs: every prompt change
// creates a new experiment, and you can see at a glance which of the 9
// assertions regressed per row. No more "oh did the em-dash rule still
// work?" — the column is right there in the Braintrust UI.

import path from "node:path";
import { config } from "dotenv";
import { Eval, initDataset } from "braintrust";
import { writeReadout } from "../../src/lib/agents/readout-writer";
import { readoutAssertions } from "../scorers/readout-assertions";
import type { ReadoutInput } from "../../src/lib/types";

config({ path: path.join(process.cwd(), ".env.local") });

const PROJECT = "Protein";

Eval(PROJECT, {
  experimentName: `readout-writer-${new Date().toISOString().slice(0, 10)}`,
  data: initDataset(PROJECT, { dataset: "readout-scenarios" }),

  // writeReadout takes the whole ReadoutInput and returns the agent's
  // text output. Assertions read that output and the original input.
  task: async (input: ReadoutInput) => writeReadout(input),

  scores: readoutAssertions,
});
