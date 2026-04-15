import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { generateObject, getPrompt, MODEL } from "../braintrust";
import type { ReceiptRead } from "../types";

const schema = z.object({
  store: z.string(),
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

export async function readReceipt(imageBase64: string, mimeType: string): Promise<ReceiptRead> {
  const system = await getPrompt("receipt-reader");
  const { object } = await generateObject({
    model: anthropic(MODEL),
    schema,
    system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: Buffer.from(imageBase64, "base64"),
            mimeType,
          },
          { type: "text", text: "Read this receipt." },
        ],
      },
    ],
  });
  return object;
}
