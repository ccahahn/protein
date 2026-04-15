import { NextRequest, NextResponse } from "next/server";
import { parsePantry } from "@/lib/agents/pantry-parser";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { descriptor: string };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const descriptor = (body.descriptor ?? "").trim();
    if (!descriptor) {
      return NextResponse.json({ error: "empty descriptor" }, { status: 400 });
    }
    const items = await parsePantry(descriptor);
    // The parser may split one descriptor into multiple items ("milk and butter");
    // return them all so the caller can replace one-for-many if needed.
    return NextResponse.json({ items });
  } catch (err) {
    console.error("pantry edit route error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "pantry edit failed" },
      { status: 500 }
    );
  }
}
