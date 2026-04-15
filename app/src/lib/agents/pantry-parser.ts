import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { generateObject, getPrompt, MODEL } from "../braintrust";
import type { PantryItem } from "../types";

const schema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      qty_estimate: z.string(),
      protein_g: z.number().min(0),
      cal: z.number().min(0),
      added_sugar_g: z.number().min(0),
      confidence: z.enum(["high", "medium", "low"]),
      reasoning: z.string().nullish(),
    })
  ),
});

export async function parsePantry(transcript: string): Promise<PantryItem[]> {
  const system = await getPrompt("pantry-parser");
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema,
    system,
    prompt: JSON.stringify({ transcript }),
  });
  return object.items;
}
