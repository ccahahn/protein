import { anthropic } from "@ai-sdk/anthropic";
import { NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { generateObject, getPrompt, MODEL } from "../braintrust";
import type { HouseholdParse, Profile } from "../types";

const sexSchema = z.preprocess((v) => {
  if (v == null) return null;
  if (typeof v !== "string") return v;
  const s = v.trim().toLowerCase();
  if (s === "m" || s === "male" || s === "man" || s === "boy") return "M";
  if (s === "f" || s === "female" || s === "woman" || s === "girl") return "F";
  if (s === "") return null;
  return v;
}, z.enum(["M", "F"]).nullish());

const profileSchema = z.object({
  name: z.string().nullish(),
  age: z.coerce.number().min(0).max(120).transform((n) => Math.round(n)),
  sex: sexSchema,
  weight_kg: z.coerce.number().min(0).nullish(),
  weightLossGoal: z.boolean().default(false),
  locked_reason: z.string().nullish(),
});

const schema = z.object({
  profiles: z.array(profileSchema),
  missing_field: z
    .object({
      profileIndex: z.coerce.number().int().min(0),
      field: z.string(),
      follow_up_question: z.string(),
    })
    .nullish(),
  diff: z
    .array(
      z.object({
        profileIndex: z.coerce.number().int(),
        field: z.string(),
        from: z.any().optional(),
        to: z.any().optional(),
      })
    )
    .nullish(),
  acknowledged_but_ignored: z.array(z.string()).nullish(),
  give_up: z.boolean().default(false),
});

export async function parseHousehold(
  transcript: string,
  priorProfiles: Profile[] | null,
  turn_count: number
): Promise<HouseholdParse> {
  const input = { transcript, priorProfiles, turn_count };
  const system = await getPrompt("household-parser");
  let object: z.infer<typeof schema>;
  try {
    const result = await generateObject({
      model: anthropic(MODEL),
      schema,
      system,
      prompt: JSON.stringify(input),
    });
    object = result.object;
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      console.error("[household-parser] schema mismatch");
      console.error("  raw text:", err.text);
      console.error("  cause:", err.cause);
      console.error("  usage:", err.usage);
    }
    throw err;
  }

  // Belt-and-suspenders enforcement of the hard lockout — never trust the model alone.
  for (const p of object.profiles) {
    if (p.age < 16) {
      if (p.weightLossGoal) {
        p.weightLossGoal = false;
        p.locked_reason =
          p.locked_reason ??
          "Weight goals for kids under 16 should involve a pediatrician (AAP guideline). Not applied.";
      }
      p.sex = null;
      p.weight_kg = null;
    }
  }
  return object;
}
