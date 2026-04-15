import { NextRequest, NextResponse } from "next/server";
import { familyDailyTargets, targetsForProfile, DRI_SOURCE } from "@/lib/dri";
import {
  combine,
  lowConfidenceItems,
  perNutrientRunway,
  pickBestPickCandidates,
  pickSugarHiding,
  proteinGapCloser,
  subtitleFor,
  sumTotals,
} from "@/lib/math";
import { writeReadout } from "@/lib/agents/readout-writer";
import type {
  NutritionItem,
  PantryItem,
  Profile,
  ReadoutInput,
  ReadoutOutput,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type RequestBody = {
  store: string;
  days: number;
  receiptItems: NutritionItem[];
  pantryItems: PantryItem[];
  profiles: Profile[];
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;
    const { store, days, receiptItems, pantryItems, profiles } = body;

    const receiptTotals = sumTotals(receiptItems);
    const pantryTotals = sumTotals(pantryItems);
    const totals = combine(receiptTotals, pantryTotals);

    const familyDaily = familyDailyTargets(profiles);
    const familyForDays = {
      protein_g: familyDaily.protein_g * days,
      cal: familyDaily.cal * days,
      added_sugar_g: familyDaily.added_sugar_g * days,
    };

    const runway = perNutrientRunway(totals, familyDaily, days);
    const allItems = [...receiptItems, ...pantryItems];
    const bestPickCandidates = pickBestPickCandidates(receiptItems);
    // Sugar hiding section runs whether the family is over the ceiling or
    // under. The "wait, really?" reveal is educational regardless of the
    // verdict — and most of the time the meaningful sugar offenders aren't
    // about a verdict at all.
    const sugarHidingItems = pickSugarHiding(allItems);
    const lowConf = lowConfidenceItems(allItems);
    const protein_short_by_days =
      runway.protein.status === "short"
        ? Math.max(0, days - runway.protein.days_covered)
        : 0;

    const perPerson = profiles.map((p) => {
      const t = targetsForProfile(p);
      return {
        name: p.name,
        age: p.age,
        protein_target: t.protein_g,
        cal_target: t.cal,
        sugar_target: t.added_sugar_g,
      };
    });

    const subtitle = subtitleFor({
      peopleCount: profiles.length,
      days,
      store,
      hasPantry: pantryItems.length > 0,
    });

    const input: ReadoutInput = {
      family: perPerson,
      days,
      totals: {
        protein_g: Math.round(totals.protein_g),
        cal: Math.round(totals.cal),
        added_sugar_g: Math.round(totals.added_sugar_g),
      },
      per_nutrient_runway: runway,
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

    // Resolve agent-picked items back to the candidate pool by name. If the
    // agent didn't return an item field (e.g., old Braintrust prompt that
    // hasn't been re-pasted yet) or returned a name we don't recognize, fall
    // back to indexed matching against the candidates pool — note[0] → top
    // candidate, note[1] → second, etc.
    const candidatesByName = new Map(
      bestPickCandidates.map((c) => [c.name, c])
    );
    const agentPicks = agentOut.best_pick_notes.flatMap((n, idx) => {
      const byName = n.item ? candidatesByName.get(n.item) : undefined;
      const fallback = bestPickCandidates[idx];
      const match = byName ?? fallback;
      return match ? [{ item: match, note: n.note }] : [];
    });
    // Pad with top candidates if agent returned fewer than expected
    // (e.g., the agent went silent on a pick). Up to 3 total.
    const usedNames = new Set(agentPicks.map((a) => a.item.name));
    let i = 0;
    while (agentPicks.length < Math.min(3, bestPickCandidates.length) && i < bestPickCandidates.length) {
      const c = bestPickCandidates[i++];
      if (!usedNames.has(c.name)) {
        agentPicks.push({ item: c, note: "" });
        usedNames.add(c.name);
      }
    }
    agentPicks.length = Math.min(agentPicks.length, 3);

    // Compute the gap closer against the AGENT's picks (so the prompted item
    // is one the user is already looking at on screen).
    const gapCloser = proteinGapCloser(
      agentPicks.map((a) => a.item),
      totals.protein_g,
      familyDaily.protein_g,
      days,
      runway.protein.status
    );

    const bestPicksOut = agentPicks.map((a) => ({
      item: a.item.name,
      protein_g: Math.round(a.item.protein_g),
      added_sugar_g: Math.round(a.item.added_sugar_g),
      note: a.note,
      gap_closer:
        gapCloser && gapCloser.item === a.item.name
          ? {
              short_by_g: gapCloser.short_by_g,
              action_text: gapCloser.action_text,
            }
          : null,
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
      runway,
      days,
      best_picks: bestPicksOut,
      sugar_hiding: sugarHidingOut,
      confidence_footnote: agentOut.confidence_footnote ?? null,
      protein_short_by_days,
    };
    return NextResponse.json({
      readout,
      debug: {
        totals,
        familyDaily,
        familyForDays,
        runway,
        bestPickCandidates,
        sugarHidingItems,
        source: DRI_SOURCE,
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
