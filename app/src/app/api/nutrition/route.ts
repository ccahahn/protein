import { NextRequest, NextResponse } from "next/server";
import { estimateNutrition } from "@/lib/agents/nutrition-estimator";
import type { RawReceiptItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  store: string;
  items: { name: string; qty: number }[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    if (!body.store || !Array.isArray(body.items)) {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }
    const raw: RawReceiptItem[] = body.items.map((i) => ({
      name: i.name,
      qty: i.qty,
      confidence: "high",
    }));
    const items = await estimateNutrition(body.store, raw);
    return NextResponse.json({ items });
  } catch (err) {
    console.error("nutrition route error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "nutrition failed" },
      { status: 500 }
    );
  }
}
