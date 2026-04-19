import { NextRequest, NextResponse } from "next/server";
import { readRecipe } from "@/lib/agents/recipe-reader";
import { estimateNutrition } from "@/lib/agents/nutrition-estimator";

export const runtime = "nodejs";
export const maxDuration = 60;

// Cap the HTML we send to Claude. Recipe pages include ads, comment threads,
// and analytics inline scripts — easy to blow past 1MB. We strip script/style
// tags and truncate the rest. 200KB is plenty for any recipe body.
const MAX_HTML_BYTES = 200_000;

function sanitizeHtml(raw: string): string {
  const stripped = raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  if (stripped.length <= MAX_HTML_BYTES) return stripped;
  return stripped.slice(0, MAX_HTML_BYTES);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { url?: string };
    const rawUrl = (body.url ?? "").trim();
    if (!rawUrl) {
      return NextResponse.json({ error: "missing url" }, { status: 400 });
    }

    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return NextResponse.json({
        unreadable: true,
        notes: "That doesn't look like a link — try pasting the full URL.",
        store: "",
        servings: 1,
        items: [],
      });
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return NextResponse.json({
        unreadable: true,
        notes: "Only http/https links work.",
        store: "",
        servings: 1,
        items: [],
      });
    }

    let html: string;
    try {
      const res = await fetch(url.toString(), {
        // Most recipe sites want a real-browser UA. Without one we get
        // robot-walls or sparse SSR-shells.
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      });
      if (!res.ok) {
        return NextResponse.json({
          unreadable: true,
          notes: `That page returned ${res.status}. Try a different link.`,
          store: "",
          servings: 1,
          items: [],
        });
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("html")) {
        return NextResponse.json({
          unreadable: true,
          notes: "That link didn't return a webpage.",
          store: "",
          servings: 1,
          items: [],
        });
      }
      html = await res.text();
    } catch (err) {
      return NextResponse.json({
        unreadable: true,
        notes:
          err instanceof Error
            ? `Couldn't fetch that URL: ${err.message}`
            : "Couldn't fetch that URL.",
        store: "",
        servings: 1,
        items: [],
      });
    }

    const recipe = await readRecipe(sanitizeHtml(html));
    if (recipe.unreadable || recipe.items.length === 0) {
      return NextResponse.json({
        unreadable: true,
        notes: recipe.notes ?? "Couldn't find a recipe on that page.",
        store: recipe.source,
        servings: recipe.servings,
        items: [],
      });
    }

    const enriched = await estimateNutrition(recipe.source, recipe.items);
    return NextResponse.json({
      unreadable: false,
      store: recipe.source,
      servings: recipe.servings,
      items: enriched,
      notes: recipe.notes,
    });
  } catch (err) {
    console.error("recipe route error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "recipe failed" },
      { status: 500 }
    );
  }
}
