import { anthropic } from "@ai-sdk/anthropic";
import { NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { generateObject, getPrompt, MODEL } from "../braintrust";
import type { ReadoutAgentOutput, ReadoutInput } from "../types";

// `item` is optional so we can survive an old Braintrust prompt that hasn't
// been re-pasted yet — in that case we'll fall back to indexed matching against
// the candidates pool in the route handler.
const schema = z.object({
  verdict_headline: z.string(),
  best_pick_notes: z.array(
    z.object({
      item: z.string().nullish(),
      note: z.string(),
    })
  ),
  sugar_hiding_notes: z.array(
    z.object({
      why: z.string(),
      fix: z
        .object({
          kind: z.enum(["swap", "aside"]),
          text: z.string(),
        })
        .nullish(),
    })
  ),
  confidence_footnote: z.string().nullish(),
});

export async function writeReadout(input: ReadoutInput): Promise<ReadoutAgentOutput> {
  const system = await getPrompt("readout-writer");
  try {
    const { object } = await generateObject({
      model: anthropic(MODEL),
      schema,
      system,
      prompt: JSON.stringify(input),
    });
    return {
      verdict_headline: object.verdict_headline,
      best_pick_notes: object.best_pick_notes.map((n) => ({
        item: n.item ?? "",
        note: n.note,
      })),
      sugar_hiding_notes: object.sugar_hiding_notes.map((n) => ({
        why: n.why,
        fix: n.fix ?? null,
      })),
      confidence_footnote: object.confidence_footnote ?? null,
    };
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      console.error("[readout-writer] schema mismatch");
      console.error("  raw text:", err.text);
      console.error("  cause:", err.cause);
      console.error("  usage:", err.usage);
    }
    throw err;
  }
}
