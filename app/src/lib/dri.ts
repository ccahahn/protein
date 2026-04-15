import table from "@/data/dri-table.json";
import type {
  PerPersonTargets,
  Profile,
  TargetExplanation,
  Targets,
} from "./types";

type ChildBand = { min: number; max: number; protein_g: number; cal: number; added_sugar_g: number };
type AdultCalBand = { min: number; max: number; cal: number };

const childBands = table.child_age_bands as ChildBand[];
const adultCalBands = table.adult_calorie_bands as { M: AdultCalBand[]; F: AdultCalBand[] };

function findBand<T extends { min: number; max: number }>(bands: T[], age: number): T {
  const b = bands.find((x) => age >= x.min && age <= x.max);
  if (!b) return bands[bands.length - 1];
  return b;
}

export function targetsForProfile(p: Profile): PerPersonTargets {
  const exp = explainTargets(p);
  return {
    profile: p,
    protein_g: p.protein_target_override ?? exp.protein_g,
    cal: p.cal_target_override ?? exp.cal,
    added_sugar_g: exp.added_sugar_g,
  };
}

export function explainTargets(p: Profile): TargetExplanation {
  if (p.age < 16) {
    const band = findBand(childBands, p.age);
    return {
      protein_g: band.protein_g,
      protein_why: `RDA for age ${band.min}–${band.max}`,
      cal: band.cal,
      cal_why: `DRI estimated energy for age ${band.min}–${band.max}, sedentary`,
      added_sugar_g: band.added_sugar_g,
      added_sugar_why: "AHA ceiling for children",
    };
  }
  const sex: "M" | "F" = p.sex ?? "F";
  const weight_kg = p.weight_kg ?? table.reference_body_weight_kg[sex];
  const weight_lb = Math.round(weight_kg * 2.205);
  const calBand = findBand(adultCalBands[sex], p.age);
  const baseCal = calBand.cal;
  const cal = p.weightLossGoal
    ? baseCal - table.weight_loss_deficit_kcal
    : baseCal;
  const calWhy = p.weightLossGoal
    ? `DRI: ${sex === "M" ? "adult male" : "adult female"}, age ${calBand.min}–${calBand.max}, sedentary (${baseCal}) − 250 for weight-loss`
    : `DRI: ${sex === "M" ? "adult male" : "adult female"}, age ${calBand.min}–${calBand.max}, sedentary`;
  const proteinWhy = p.hide_weight
    ? `0.8 g/kg × weight (private)`
    : `0.8 g/kg × ${weight_lb} lb (~${Math.round(weight_kg)} kg)`;
  return {
    protein_g: Math.round(table.adult_protein_per_kg * weight_kg),
    protein_why: proteinWhy,
    cal,
    cal_why: calWhy,
    added_sugar_g: table.adult_added_sugar_g[sex],
    added_sugar_why:
      sex === "M"
        ? "AHA ceiling for adult men (36 g/day)"
        : "AHA ceiling for adult women (25 g/day)",
  };
}

export function familyDailyTargets(profiles: Profile[]): Targets {
  return profiles
    .map(targetsForProfile)
    .reduce<Targets>(
      (acc, t) => ({
        protein_g: acc.protein_g + t.protein_g,
        cal: acc.cal + t.cal,
        added_sugar_g: acc.added_sugar_g + t.added_sugar_g,
      }),
      { protein_g: 0, cal: 0, added_sugar_g: 0 }
    );
}

export const DRI_SOURCE = table.source_version;
