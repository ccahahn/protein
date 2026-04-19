import { NextRequest, NextResponse } from "next/server";
import {
  lowConfidenceItems,
  pickBestPickCandidates,
  pickSugarHiding,
  subtitleFor,
  sumTotals,
} from "@/lib/math";
import { writeReadout } from "@/lib/agents/readout-writer";
import type {
  NutritionItem,
  ReadoutInput,
  ReadoutOutput,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = {
  store: string;
  receiptItems: NutritionItem[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const { store, receiptItems } = body;

    const totals = sumTotals(receiptItems);
    const bestPickCandidates = pickBestPickCandidates(receiptItems);
    const sugarHidingItems = pickSugarHiding(receiptItems);
    const lowConf = lowConfidenceItems(receiptItems);

    const subtitle = subtitleFor({
      itemCount: receiptItems.length,
      store,
    });

    const input: ReadoutInput = {
      totals: {
        protein_g: Math.round(totals.protein_g),
        cal: Math.round(totals.cal),
        added_sugar_g: Math.round(totals.added_sugar_g),
      },
      subtitle,
      best_pick_candidates: bestPickCandidates.map((b) => ({
        item: b.name,
        protein_g: Math.round(b.protein_g),
        added_sugar_g: Math.round(b.added_sugar_g),
        cal: Math.round(b.cal),
      })),
      sugar_hiding: sugarHidingItems.map((b) => ({
        item: b.name,
        added_sugar_g: Math.round(b.added_sugar_g),
        protein_g: Math.round(b.protein_g),
        cal: Math.round(b.cal),
      })),
      low_confidence_items: lowConf.slice(0, 5),
      store,
    };

    const agentOut = await writeReadout(input);

    // Resolve agent-picked items back to the candidate pool by name. Fall
    // back to indexed matching if the agent returned a name we don't
    // recognize.
    const candidatesByName = new Map(
      bestPickCandidates.map((c) => [c.name, c])
    );
    const agentPicks = agentOut.best_pick_notes.flatMap((n, idx) => {
      const byName = n.item ? candidatesByName.get(n.item) : undefined;
      const fallback = bestPickCandidates[idx];
      const match = byName ?? fallback;
      return match ? [{ item: match, note: n.note }] : [];
    });
    // Pad with top candidates if the agent returned fewer than 3.
    const usedNames = new Set(agentPicks.map((a) => a.item.name));
    let i = 0;
    while (
      agentPicks.length < Math.min(3, bestPickCandidates.length) &&
      i < bestPickCandidates.length
    ) {
      const c = bestPickCandidates[i++];
      if (!usedNames.has(c.name)) {
        agentPicks.push({ item: c, note: "" });
        usedNames.add(c.name);
      }
    }
    agentPicks.length = Math.min(agentPicks.length, 3);

    const bestPicksOut = agentPicks.map((a) => ({
      item: a.item.name,
      protein_g: Math.round(a.item.protein_g),
      added_sugar_g: Math.round(a.item.added_sugar_g),
      note: a.note,
    }));
    const sugarHidingOut = input.sugar_hiding.map((s, i) => ({
      item: s.item,
      added_sugar_g: s.added_sugar_g,
      why: agentOut.sugar_hiding_notes[i]?.why ?? "",
      fix: agentOut.sugar_hiding_notes[i]?.fix ?? null,
    }));

    const readout: ReadoutOutput = {
      verdict_headline: agentOut.verdict_headline,
      subtitle,
      totals: input.totals,
      best_picks: bestPicksOut,
      sugar_hiding: sugarHidingOut,
      confidence_footnote: agentOut.confidence_footnote ?? null,
    };
    return NextResponse.json({
      readout,
      debug: {
        totals,
        bestPickCandidates,
        sugarHidingItems,
      },
    });
  } catch (err) {
    console.error("readout route error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "readout failed" },
      { status: 500 }
    );
  }
}
