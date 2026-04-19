// Cheap deterministic assertions for the readout-writer agent.
//
// TWO KINDS OF EVALS — for agents that output subjective text, you can't
// just diff against a "correct answer" like you can with nutrition numbers.
// You need two layers:
//
//   1. CHEAP ASSERTIONS (this file). Fast, deterministic, binary. Catch
//      rule violations: decimals, day-of-week names, emoji, contradictions
//      between headline and the sugar-hiding section. No LLM required,
//      ~instant, always reliable. These catch the "cocoa puffs advice"
//      and "2.7 of 5 days" class of bug — rules we explicitly wrote into
//      the prompt.
//
//   2. LLM JUDGE (deferred to v1). A second LLM scores the output on
//      subjective criteria like "does this sound like a friend at coffee."
//      Expensive, slow, and must be calibrated against human-graded
//      examples before you trust it (per feedback_calibration memory).
//
// For now we only do #1.

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
// trap.
const DAY_NAMES_RE =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i;
export function headlineNoDayOfWeek(args: ScorerArgs) {
  const hit = DAY_NAMES_RE.test(args.output.verdict_headline);
  return { name: "headline_no_day_of_week", score: hit ? 0 : 1 };
}

// RULE: calories are not part of the readout surface. Headline must not
// mention them in either direction.
const CALORIE_RE = /\bcalori|\bkcal\b|\bkilocal/i;
export function headlineNoCalories(args: ScorerArgs) {
  const hit = CALORIE_RE.test(args.output.verdict_headline);
  return { name: "headline_no_calories", score: hit ? 0 : 1 };
}

// RULE: no household / per-person / days-covered language anywhere in
// the agent's output. The app has no idea who is eating the food or over
// what timeframe — pretending otherwise is the single biggest trust risk
// in the new reveal-only shape.
const HOUSEHOLD_RE =
  /\b(family|household|per person|per-person|for \d+ days?|daily|ceiling|limit|runway|days covered|days? of protein|days? of sugar)\b/i;
function anyMatches(re: RegExp, strings: string[]) {
  return strings.some((s) => re.test(s));
}
export function noHouseholdOrDayTalk(args: ScorerArgs) {
  const strings = [
    args.output.verdict_headline,
    ...args.output.best_pick_notes.map((n) => n.note),
    ...args.output.sugar_hiding_notes.flatMap((n) => [n.why, n.fix?.text ?? ""]),
  ];
  const hit = anyMatches(HOUSEHOLD_RE, strings);
  return { name: "no_household_or_day_talk", score: hit ? 0 : 1 };
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

// RULE: headline must match the sugar-hiding data. If the input has
// sugar-hiding items, the headline should acknowledge them (ideally by
// naming one offender). If sugar-hiding is empty, the headline should
// not fabricate a sugar problem.
export function headlineMatchesSugarHiding(args: ScorerArgs) {
  const h = args.output.verdict_headline.toLowerCase();
  const hasHiders = args.input.sugar_hiding.length > 0;
  const mentionsSugar =
    h.includes("sugar") ||
    args.input.sugar_hiding.some((s) => h.includes(s.item.toLowerCase()));

  if (hasHiders) {
    return {
      name: "headline_matches_sugar_hiding",
      score: mentionsSugar ? 1 : 0,
    };
  }
  // No hiders: headline should not invent a sugar problem. We allow
  // positive mentions like "you kept free of added sugar" — detect
  // negative framing specifically.
  const negativeSugar =
    /\b(over|too much|sneaking|sneaky|hiding|problem|blowing|a lot of) .*sugar\b/i.test(
      args.output.verdict_headline
    );
  return {
    name: "headline_matches_sugar_hiding",
    score: negativeSugar ? 0 : 1,
  };
}

// ---------- BEST-PICK RULES ----------

// RULE: agent-picked items must all exist in best_pick_candidates.
export function bestPicksAreValid(args: ScorerArgs) {
  const allowed = new Set(
    args.input.best_pick_candidates.map((c) => c.item)
  );
  const picks = args.output.best_pick_notes ?? [];
  if (picks.length === 0) {
    const ok = args.input.best_pick_candidates.length === 0;
    return { name: "best_picks_valid_names", score: ok ? 1 : 0 };
  }
  const allValid = picks.every((n) => !n.item || allowed.has(n.item));
  return { name: "best_picks_valid_names", score: allValid ? 1 : 0 };
}

// RULE: best pick notes must not mention calories.
export function bestPickNotesNoCalories(args: ScorerArgs) {
  const picks = args.output.best_pick_notes ?? [];
  const allClean = picks.every((n) => !CALORIE_RE.test(n.note));
  return { name: "best_pick_notes_no_calories", score: allClean ? 1 : 0 };
}

// ---------- SUGAR-HIDING RULES ----------

// RULE: sugar_hiding_notes length must match the input's sugar_hiding
// length.
export function sugarHidingLengthMatches(args: ScorerArgs) {
  const inputLen = args.input.sugar_hiding.length;
  const outputLen = args.output.sugar_hiding_notes?.length ?? 0;
  return {
    name: "sugar_hiding_length_matches",
    score: inputLen === outputLen ? 1 : 0,
  };
}

export const readoutAssertions = [
  headlineNoDecimals,
  headlineNoDayOfWeek,
  headlineNoCalories,
  noHouseholdOrDayTalk,
  headlineNoEmojiOrExcitement,
  headlineNoEmDash,
  headlineMatchesSugarHiding,
  bestPicksAreValid,
  bestPickNotesNoCalories,
  sugarHidingLengthMatches,
];
