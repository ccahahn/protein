import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { generateObject, getPrompt, MODEL } from "../braintrust";
import type { RecipeRead } from "../types";

const schema = z.object({
  source: z.string(),
  servings: z.number().int().min(1),
  items: z.array(
    z.object({
      name: z.string(),
      qty: z.number().int().min(1),
      confidence: z.enum(["high", "medium", "low"]),
    })
  ),
  unreadable: z.boolean(),
  notes: z.string().nullish(),
});

export async function readRecipe(html: string): Promise<RecipeRead> {
  const system = await getPrompt("recipe-reader");
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema,
    system,
    prompt: html,
  });
  return {
    source: object.source,
    servings: object.servings,
    items: object.items,
    unreadable: object.unreadable,
    notes: object.notes ?? null,
  };
}
