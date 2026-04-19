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

export type RecipeRead = {
  source: string;
  servings: number;
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

export type Totals = {
  protein_g: number;
  cal: number;
  added_sugar_g: number;
};

export type ReadoutInput = {
  totals: Totals;
  // Per-serving totals. Only populated for recipes (servings > 1); undefined
  // for receipts. The readout writer doesn't use these numerically; they're
  // for the tiles + optional agent mention in the headline.
  per_serving?: Totals;
  servings?: number;
  subtitle: string;
  // Best pick CANDIDATES — server provides up to 8 viable items (≥10g protein,
  // <10g added sugar, sorted by protein desc). The agent picks 3 from this
  // pool and writes a note per pick.
  best_pick_candidates: {
    item: string;
    protein_g: number;
    added_sugar_g: number;
    cal: number;
  }[];
  // Pre-picked items for the "where the added sugar is hiding" section —
  // items with ≥10g added sugar, top 3 by added sugar desc. Empty when
  // nothing qualifies (in which case the agent's headline covers the
  // "you kept free of added sugar" case).
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
  totals: Totals;
  per_serving?: Totals;
  servings?: number;
  best_picks: {
    item: string;
    protein_g: number;
    added_sugar_g: number;
    note: string;
  }[];
  sugar_hiding: {
    item: string;
    added_sugar_g: number;
    why: string;
    fix: { kind: "swap" | "aside"; text: string } | null;
  }[];
  confidence_footnote?: string | null;
};
