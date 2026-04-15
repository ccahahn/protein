import * as ai from "ai";
import { initLogger, loadPrompt, wrapAISDK } from "braintrust";

const BRAINTRUST_PROJECT_ID = "e37e6a6b-76d3-45b3-8c90-a49e8d88111c";
const BRAINTRUST_PROJECT_NAME = "Protein";

if (!process.env.BRAINTRUST_API_KEY) {
  console.warn(
    "[braintrust] BRAINTRUST_API_KEY not set — prompt loading and tracing will fail."
  );
}

initLogger({
  projectId: BRAINTRUST_PROJECT_ID,
  projectName: BRAINTRUST_PROJECT_NAME,
  apiKey: process.env.BRAINTRUST_API_KEY,
});

// Wrap the AI SDK module so every generateObject / generateText call produces a
// Braintrust span with inputs, outputs, latency, and token counts.
const wrapped = wrapAISDK(ai);
export const generateObject = wrapped.generateObject;
export const generateText = wrapped.generateText;

// Prompts live in Braintrust. Each agent loads its system prompt by slug at
// first use and caches it in memory for the life of the serverless instance.
const cache = new Map<string, string>();

type ChatMessage = { role: string; content: unknown };

function extractSystemText(built: unknown): string {
  if (!built || typeof built !== "object") return "";
  const withMessages = built as { messages?: ChatMessage[] };
  const messages = withMessages.messages ?? [];
  const systemMsg = messages.find((m) => m.role === "system");
  if (!systemMsg) return "";
  const content = systemMsg.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p: unknown) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object" && "text" in p) {
          return String((p as { text: unknown }).text);
        }
        return "";
      })
      .join("");
  }
  return "";
}

export async function getPrompt(slug: string): Promise<string> {
  const cached = cache.get(slug);
  if (cached) return cached;

  const apiKey = process.env.BRAINTRUST_API_KEY;
  if (!apiKey) {
    throw new Error(
      "BRAINTRUST_API_KEY is not set. Put it in .env.local (local) or Vercel env vars (prod)."
    );
  }
  const prompt = await loadPrompt({
    projectId: BRAINTRUST_PROJECT_ID,
    slug,
    apiKey,
  });
  const built = prompt.build({});
  const system = extractSystemText(built);
  if (!system) {
    throw new Error(
      `Braintrust prompt "${slug}" returned no system message. Check the prompt in project "${BRAINTRUST_PROJECT_NAME}" — it must have a system role message.`
    );
  }
  cache.set(slug, system);
  return system;
}

// Latest Sonnet (4.6). Bump this when a newer model ships. Not env-driven
// because an overridable model makes the readout non-reproducible across
// environments — and the whole point of pinning prompts in Braintrust is
// making behavior reproducible.
export const MODEL = "claude-sonnet-4-6";
