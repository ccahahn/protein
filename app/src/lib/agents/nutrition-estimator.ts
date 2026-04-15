import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { generateObject, getPrompt, MODEL } from "../braintrust";
import type { NutritionItem, RawReceiptItem } from "../types";
import overridesFile from "@/data/product-overrides.json";

type Overrides = Record<
  string,
  Record<string, { protein_g: number; cal: number; added_sugar_g: number; per: "package" | "unit" }>
>;
const overrides = (overridesFile.overrides ?? {}) as Overrides;

function applyOverride(
  store: string,
  item: RawReceiptItem
): NutritionItem | null {
  const storeMap = overrides[store];
  if (!storeMap) return null;
  const key = item.name.trim().toLowerCase();
  const hit = storeMap[key];
  if (!hit) return null;
  const mult = hit.per === "unit" ? item.qty : 1;
  return {
    name: item.name,
    qty: item.qty,
    protein_g: hit.protein_g * mult,
    cal: hit.cal * mult,
    added_sugar_g: hit.added_sugar_g * mult,
    confidence: "high",
    reasoning: "matched handpicked override",
  };
}

const schema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      qty: z.number().int().min(1),
      protein_g: z.number().min(0),
      cal: z.number().min(0),
      added_sugar_g: z.number().min(0),
      confidence: z.enum(["high", "medium", "low"]),
      reasoning: z.string().nullish(),
    })
  ),
});

export async function estimateNutrition(
  store: string,
  items: RawReceiptItem[]
): Promise<NutritionItem[]> {
  const overridden: (NutritionItem | null)[] = items.map((it) => applyOverride(store, it));
  const needLLM = items
    .map((it, i) => ({ it, i }))
    .filter(({ i }) => overridden[i] === null);

  if (needLLM.length === 0) return overridden as NutritionItem[];

  const input = {
    store,
    items: needLLM.map(({ it }) => ({ name: it.name, qty: it.qty })),
  };

  const system = await getPrompt("nutrition-estimator");
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema,
    system,
    prompt: JSON.stringify(input),
  });

  const llmResults: NutritionItem[] = object.items;
  const out: NutritionItem[] = [];
  let llmIdx = 0;
  for (let i = 0; i < items.length; i++) {
    if (overridden[i]) {
      out.push(overridden[i] as NutritionItem);
    } else {
      out.push(llmResults[llmIdx++]);
    }
  }
  return out;
}
