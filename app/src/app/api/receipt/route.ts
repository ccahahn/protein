import { NextRequest, NextResponse } from "next/server";
import { readReceipt } from "@/lib/agents/receipt-reader";
import { estimateNutrition } from "@/lib/agents/nutrition-estimator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "missing image" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");
    const mimeType = file.type || "image/jpeg";

    const receipt = await readReceipt(base64, mimeType);
    if (receipt.unreadable || receipt.items.length === 0) {
      return NextResponse.json({
        unreadable: true,
        notes: receipt.notes ?? "couldn't read that",
        store: receipt.store,
        items: [],
      });
    }

    const enriched = await estimateNutrition(receipt.store, receipt.items);
    return NextResponse.json({
      unreadable: false,
      store: receipt.store,
      items: enriched,
      notes: receipt.notes,
    });
  } catch (err) {
    console.error("receipt route error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "receipt failed" },
      { status: 500 }
    );
  }
}
