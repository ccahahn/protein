// Cheap deterministic assertions for the readout-writer agent.
//
// TWO KINDS OF EVALS — for agents that output subjective text, you can't
// just diff against a "correct answer" like you can with nutrition numbers.
// You need two layers:
//
//   1. CHEAP ASSERTIONS (this file). Fast, deterministic, binary. Catch
//      rule violations: decimals, day-of-week names, emoji, contradictions
//      between headline and status. No LLM required, ~instant, always
//      reliable. These catch the "cocoa puffs advice" and "2.7 of 5 days"
//      class of bug — rules we explicitly wrote into the prompt.
//
//   2. LLM JUDGE (deferred to v1). A second LLM scores the output on
//      subjective criteria like "does this sound like a friend at coffee."
//      Expensive, slow, and must be calibrated against human-graded
//      examples before you trust it (per feedback_calibration memory).
//
// For now we only do #1. That's intentional — cheap assertions have the
// best return on effort and catch the bugs you care most about first.
//
// Each scorer below returns a single {name, score} in [0, 1]. Zero is
// fail, one is pass. The Braintrust UI shows each as its own column so
// you can sort failing rows by assertion type.

import type { ReadoutAgentOutput, ReadoutInput } from "../../src/lib/types";

type ScorerArgs = {
  input: ReadoutInput;
  output: ReadoutAgentOutput;
};

// ---------- HEADLINE RULES ----------

// RULE: days are always whole integers in user-visible text. A decimal
// in the headline means the agent computed something it shouldn't have.
export function headlineNoDecimals(args: ScorerArgs) {
  const hasDecimal = /\d+\.\d/.test(args.output.verdict_headline);
  return { name: "headline_no_decimals", score: hasDecimal ? 0 : 1 };
}

// RULE: no day-of-week names. The app doesn't know when the user runs it
// versus when the food will be eaten, so "runs out Wednesday" is a trust
// trap. Always relative days.
const DAY_NAMES_RE =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i;
export function headlineNoDayOfWeek(args: ScorerArgs) {
  const hit = DAY_NAMES_RE.test(args.output.verdict_headline);
  return { name: "headline_no_day_of_week", score: hit ? 0 : 1 };
}

// RULE: calories are not part of the readout surface. Headline must not
// mention them in either direction ("you're short on calories" OR "lots
// of calories"). This is the guardrail against the old cocoa-puffs bug.
const CALORIE_RE = /\bcalori|\bkcal\b|\bkilocal/i;
export function headlineNoCalories(args: ScorerArgs) {
  const hit = CALORIE_RE.test(args.output.verdict_headline);
  return { name: "headline_no_calories", score: hit ? 0 : 1 };
}

// RULE: no emoji, no exclamation points. Friend at coffee, not macro app.
const EMOJI_RE = /\p{Extended_Pictographic}/u;
export function headlineNoEmojiOrExcitement(args: ScorerArgs) {
  const hasEmoji = EMOJI_RE.test(args.output.verdict_headline);
  const hasBang = args.output.verdict_headline.includes("!");
  return {
    name: "headline_no_emoji_or_excitement",
    score: hasEmoji || hasBang ? 0 : 1,
  };
}

// RULE: no em dashes in the headline. We allow them in sugar_hiding notes
// (that section reads more like a deep dive) but the headline must stay
// clean per the user's preference.
export function headlineNoEmDash(args: ScorerArgs) {
  const hit = args.output.verdict_headline.includes("—");
  return { name: "headline_no_em_dash", score: hit ? 0 : 1 };
}

// RULE: headline must match the nutrient status fields. If sugar.status
// is "over," the headline must acknowledge the sugar problem. If protein
// is "short," the headline must say so.
//
// This is the single most load-bearing rule in the whole readout — if
// the user scans the cards and spots a lie in one second, trust is gone.
// We check it with a loose word match, not an LLM, because the semantic
// space is narrow: there's basically one way to name a sugar problem.
export function headlineMatchesStatus(args: ScorerArgs) {
  const h = args.output.verdict_headline.toLowerCase();
  const runway = args.input.per_nutrient_runway;
  const checks: { name: string; ok: boolean }[] = [];

  if (runway.sugar.status === "over") {
    const mentionsSugar =
      h.includes("sugar") ||
      // or names a specific sugar-hiding item
      args.input.sugar_hiding.some((s) => h.includes(s.item.toLowerCase()));
    checks.push({ name: "sugar_over_acknowledged", ok: mentionsSugar });
  }
  if (runway.protein.status === "short") {
    const acknowledgesShort =
      h.includes("protein") &&
      // simple negative-sentiment words that would show up
      /(short|need|more|light|under|not enough|low)/i.test(h);
    checks.push({ name: "protein_short_acknowledged", ok: acknowledgesShort });
  }

  if (checks.length === 0) return { name: "headline_matches_status", score: 1 };
  const allOk = checks.every((c) => c.ok);
  return { name: "headline_matches_status", score: allOk ? 1 : 0 };
}

// ---------- BEST-PICK RULES ----------

// RULE: agent-picked items must all exist in best_pick_candidates. If the
// agent invents an item name, our server-side fallback will indexed-match,
// but we still want to know the agent misbehaved so we can tighten the
// prompt.
export function bestPicksAreValid(args: ScorerArgs) {
  const allowed = new Set(
    args.input.best_pick_candidates.map((c) => c.item)
  );
  const picks = args.output.best_pick_notes ?? [];
  if (picks.length === 0) {
    // Empty is valid if there were zero candidates
    const ok = args.input.best_pick_candidates.length === 0;
    return { name: "best_picks_valid_names", score: ok ? 1 : 0 };
  }
  const allValid = picks.every((n) => !n.item || allowed.has(n.item));
  return { name: "best_picks_valid_names", score: allValid ? 1 : 0 };
}

// RULE: best pick notes must not mention calories. Same surface-level rule
// as the headline — calories don't belong in the readout.
export function bestPickNotesNoCalories(args: ScorerArgs) {
  const picks = args.output.best_pick_notes ?? [];
  const allClean = picks.every((n) => !CALORIE_RE.test(n.note));
  return { name: "best_pick_notes_no_calories", score: allClean ? 1 : 0 };
}

// ---------- SUGAR-HIDING RULES ----------

// RULE: sugar_hiding_notes length must match the input's sugar_hiding
// length. The agent zips notes onto server-picked items one-to-one.
export function sugarHidingLengthMatches(args: ScorerArgs) {
  const inputLen = args.input.sugar_hiding.length;
  const outputLen = args.output.sugar_hiding_notes?.length ?? 0;
  return {
    name: "sugar_hiding_length_matches",
    score: inputLen === outputLen ? 1 : 0,
  };
}

// Bundle all assertions. Export a single array so the eval file can pass
// them to `scores:` in one go.
export const readoutAssertions = [
  headlineNoDecimals,
  headlineNoDayOfWeek,
  headlineNoCalories,
  headlineNoEmojiOrExcitement,
  headlineNoEmDash,
  headlineMatchesStatus,
  bestPicksAreValid,
  bestPickNotesNoCalories,
  sugarHidingLengthMatches,
];
