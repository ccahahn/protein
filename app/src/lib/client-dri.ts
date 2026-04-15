// Client-safe mirror of dri.ts. Kept in sync manually — when dri-table.json
// changes, update the constants here too. Used by TargetsStep (to show the
// math) and ReadoutScreen (to show the per-person breakdown).
import type { Profile } from "./types";

const CHILD_BANDS = [
  { min: 1, max: 3, protein: 13, cal: 1000, sugar: 25 },
  { min: 4, max: 8, protein: 19, cal: 1400, sugar: 25 },
  { min: 9, max: 13, protein: 34, cal: 1800, sugar: 25 },
  { min: 14, max: 15, protein: 52, cal: 2400, sugar: 25 },
];

const ADULT_CAL: Record<"M" | "F", { min: number; max: number; cal: number }[]> = {
  M: [
    { min: 16, max: 18, cal: 2800 },
    { min: 19, max: 30, cal: 2600 },
    { min: 31, max: 50, cal: 2400 },
    { min: 51, max: 200, cal: 2200 },
  ],
  F: [
    { min: 16, max: 18, cal: 2000 },
    { min: 19, max: 30, cal: 2000 },
    { min: 31, max: 50, cal: 1800 },
    { min: 51, max: 200, cal: 1800 },
  ],
};

const REF_WEIGHT_KG: Record<"M" | "F", number> = { M: 80, F: 65 };
const WEIGHT_LOSS_DEFICIT = 250;

export type Explained = {
  protein_g: number;
  protein_why: string;
  cal: number;
  cal_why: string;
  added_sugar_g: number;
  added_sugar_why: string;
};

export function explainTargets(p: Profile): Explained {
  if (p.age < 16) {
    const band =
      CHILD_BANDS.find((b) => p.age >= b.min && p.age <= b.max) ??
      CHILD_BANDS[CHILD_BANDS.length - 1];
    return {
      protein_g: band.protein,
      protein_why: `RDA for age ${band.min}–${band.max}`,
      cal: band.cal,
      cal_why: `DRI energy for age ${band.min}–${band.max}, sedentary`,
      added_sugar_g: band.sugar,
      added_sugar_why: "AHA ceiling for children (25 g/day)",
    };
  }
  const sex: "M" | "F" = p.sex ?? "F";
  const weight_kg = p.weight_kg ?? REF_WEIGHT_KG[sex];
  const weight_lb = Math.round(weight_kg * 2.205);
  const calBand =
    ADULT_CAL[sex].find((b) => p.age >= b.min && p.age <= b.max) ??
    ADULT_CAL[sex][ADULT_CAL[sex].length - 1];
  const baseCal = calBand.cal;
  const cal = p.weightLossGoal ? baseCal - WEIGHT_LOSS_DEFICIT : baseCal;
  const proteinWhy = p.hide_weight
    ? `0.8 g/kg × weight (private)`
    : `0.8 g/kg × ${weight_lb} lb (~${Math.round(weight_kg)} kg)`;
  return {
    protein_g: Math.round(0.8 * weight_kg),
    protein_why: proteinWhy,
    cal,
    cal_why: p.weightLossGoal
      ? `DRI ${sex === "M" ? "adult male" : "adult female"} ${calBand.min}–${calBand.max}, sedentary (${baseCal}) − ${WEIGHT_LOSS_DEFICIT} for weight-loss`
      : `DRI ${sex === "M" ? "adult male" : "adult female"} ${calBand.min}–${calBand.max}, sedentary`,
    added_sugar_g: sex === "M" ? 36 : 25,
    added_sugar_why:
      sex === "M"
        ? "AHA ceiling for adult men (36 g/day)"
        : "AHA ceiling for adult women (25 g/day)",
  };
}

export function effectiveTargets(p: Profile): {
  protein_g: number;
  cal: number;
  added_sugar_g: number;
} {
  const e = explainTargets(p);
  return {
    protein_g: p.protein_target_override ?? e.protein_g,
    cal: p.cal_target_override ?? e.cal,
    added_sugar_g: e.added_sugar_g,
  };
}
