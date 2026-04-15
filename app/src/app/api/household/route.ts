import { NextRequest, NextResponse } from "next/server";
import { transcribe } from "@/lib/deepgram";
import { parseHousehold } from "@/lib/agents/household-parser";
import type { Profile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!audio || !(audio instanceof File)) {
      return NextResponse.json({ error: "missing audio" }, { status: 400 });
    }
    const priorRaw = form.get("priorProfiles");
    const turnCountRaw = form.get("turn_count");
    const priorProfiles: Profile[] | null =
      typeof priorRaw === "string" && priorRaw.length > 0 ? JSON.parse(priorRaw) : null;
    const turn_count =
      typeof turnCountRaw === "string" ? parseInt(turnCountRaw, 10) || 0 : 0;

    const buf = Buffer.from(await audio.arrayBuffer());
    const transcript = await transcribe(buf, audio.type || "audio/webm");
    if (!transcript.trim()) {
      return NextResponse.json({ transcript: "", parse: null });
    }
    const parse = await parseHousehold(transcript, priorProfiles, turn_count);
    return NextResponse.json({ transcript, parse });
  } catch (err) {
    console.error("household route error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "household failed" },
      { status: 500 }
    );
  }
}
