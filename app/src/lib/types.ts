export type Confidence = "high" | "medium" | "low";

export type RawReceiptItem = {
  name: string;
  qty: number;
  confidence: Confidence;
};

export type ReceiptRead = {
  store: string;
  items: RawReceiptItem[];
  unreadable: boolean;
  notes?: string | null;
};

export type NutritionItem = {
  name: string;
  qty: number;
  protein_g: number;
  cal: number;
  added_sugar_g: number;
  confidence: Confidence;
  reasoning?: string | null;
};

export type PantryItem = {
  name: string;
  qty_estimate: string;
  protein_g: number;
  cal: number;
  added_sugar_g: number;
  confidence: Confidence;
  reasoning?: string | null;
};

export type Profile = {
  name?: string | null;
  age: number;
  sex?: "M" | "F" | null;
  weight_kg?: number | null;
  weightLossGoal: boolean;
  locked_reason?: string | null;
  protein_target_override?: number;
  cal_target_override?: number;
  hide_weight?: boolean;
};

export type TargetExplanation = {
  protein_g: number;
  protein_why: string;
  cal: number;
  cal_why: string;
  added_sugar_g: number;
  added_sugar_why: string;
};

export type HouseholdParse = {
  profiles: Profile[];
  missing_field?: {
    profileIndex: number;
    field: string;
    follow_up_question: string;
  } | null;
  diff?:
    | { profileIndex: number; field: string; from?: unknown; to?: unknown }[]
    | null;
  acknowledged_but_ignored?: string[] | null;
  give_up: boolean;
};

export type Targets = {
  protein_g: number;
  cal: number;
  added_sugar_g: number;
};

export type PerPersonTargets = Targets & { profile: Profile };

export type Totals = {
  protein_g: number;
  cal: number;
  added_sugar_g: number;
};

export type NutrientStatus = "ok" | "short" | "over";

export type Runway = {
  days_covered: number;
  status: NutrientStatus;
};

export type PerNutrientRunway = {
  protein: Runway;
  calories: Runway;
  sugar: Runway;
};

export type TopOffender = {
  item: string;
  nutrient: "protein" | "calories" | "sugar";
  contribution_g_or_cal: number;
  direction: "shortfall" | "overage";
};

export type ReadoutInput = {
  family: {
    name?: string | null;
    age: number;
    protein_target: number;
    cal_target: number;
    sugar_target: number;
  }[];
  days: number;
  totals: Totals;
  per_nutrient_runway: PerNutrientRunway;
  subtitle: string;
  // Best pick CANDIDATES — server provides up to 8 viable items (≥10g protein,
  // <10g added sugar, sorted by protein desc). The agent picks 3 from this
  // pool based on its own judgment. The agent considers tradeoffs the server
  // can't (calories vs yumminess, surprise vs workhorse, variety) and is told
  // to lean into anything genuinely interesting.
  best_pick_candidates: {
    item: string;
    protein_g: number;
    added_sugar_g: number;
    cal: number;
  }[];
  // Pre-picked items for the "where the added sugar is hiding" section.
  // Always populated when there are items with notable added sugar — the
  // educational reveal works whether the family is over the ceiling or under.
  // Agent writes a note per item.
  sugar_hiding: { item: string; added_sugar_g: number; protein_g: number; cal: number }[];
  low_confidence_items: { item: string; reason: string }[];
  store: string;
};

// The agent picks an item from best_pick_candidates by name and writes its note.
// Up to 3 entries. Server validates that the item exists in the candidates pool.
export type BestPickNote = { item: string; note: string };

// Each sugar-hiding item gets a why line + an optional swap OR aside.
// swap = terracotta arrow-prefixed action ("→ Just get two boxes of Corn Flakes")
// aside = yellow italic softer note ("Not a deal-breaker — just FYI")
export type SugarHidingNote = {
  why: string;
  fix?: { kind: "swap" | "aside"; text: string } | null;
};

// What the readout-writer AGENT returns. It writes the headline, the best-pick
// notes (in order), the sugar-hiding notes (in order), and optionally a
// confidence footnote. It never picks items or computes numbers.
export type ReadoutAgentOutput = {
  verdict_headline: string;
  best_pick_notes: BestPickNote[];
  sugar_hiding_notes: SugarHidingNote[];
  confidence_footnote?: string | null;
};

// Final readout assembled on the server and sent to the client.
// Items are server-picked; agent wrote the notes.
export type ReadoutOutput = {
  verdict_headline: string;
  subtitle: string;
  runway: PerNutrientRunway;
  days: number;
  best_picks: {
    item: string;
    protein_g: number;
    added_sugar_g: number;
    note: string;
    // Set on the single best pick that, if the user grabbed N more of it,
    // would close the protein gap. Server-computed, never agent-written.
    gap_closer?: {
      short_by_g: number;
      action_text: string; // "Add 6 more for 5/5 days."
    } | null;
  }[];
  // The whole-number day delta when protein is short, for headline context.
  // 0 when protein is already covered.
  protein_short_by_days?: number;
  sugar_hiding: {
    item: string;
    added_sugar_g: number;
    why: string;
    fix: { kind: "swap" | "aside"; text: string } | null;
  }[];
  confidence_footnote?: string | null;
};
