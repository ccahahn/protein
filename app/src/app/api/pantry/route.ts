import { NextRequest, NextResponse } from "next/server";
import { transcribe } from "@/lib/deepgram";
import { parsePantry } from "@/lib/agents/pantry-parser";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!audio || !(audio instanceof File)) {
      return NextResponse.json({ error: "missing audio" }, { status: 400 });
    }
    const buf = Buffer.from(await audio.arrayBuffer());
    const transcript = await transcribe(buf, audio.type || "audio/webm");
    if (!transcript.trim()) {
      return NextResponse.json({ transcript: "", items: [] });
    }
    const items = await parsePantry(transcript);
    return NextResponse.json({ transcript, items });
  } catch (err) {
    console.error("pantry route error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "pantry failed" },
      { status: 500 }
    );
  }
}
