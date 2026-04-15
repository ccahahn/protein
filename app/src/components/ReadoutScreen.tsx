"use client";
import { useState } from "react";
import type {
  NutritionItem,
  PantryItem,
  Profile,
  ReadoutOutput,
} from "@/lib/types";
import { effectiveTargets, explainTargets } from "@/lib/client-dri";

type Props = {
  readout: ReadoutOutput;
  receiptItems: NutritionItem[];
  pantryItems: PantryItem[];
  profiles: Profile[];
  days: number;
  store: string;
  onRestart: () => void;
};

function sumField<T extends { protein_g: number; cal: number; added_sugar_g: number }>(
  items: T[],
  field: "protein_g" | "cal" | "added_sugar_g"
): number {
  return Math.round(items.reduce((a, i) => a + i[field], 0));
}

export function ReadoutScreen({
  readout,
  receiptItems,
  pantryItems,
  profiles,
  days,
  store,
  onRestart,
}: Props) {
  const [showItems, setShowItems] = useState(false);
  const [showTargets, setShowTargets] = useState(false);

  const runway = readout.runway;
  const proteinOk = runway.protein.status === "ok";
  const sugarOver = runway.sugar.status === "over";

  const pctSugar = Math.round((runway.sugar.days_covered / days) * 100);
  const proteinDays = runway.protein.days_covered;

  const receiptTotals = {
    protein_g: sumField(receiptItems, "protein_g"),
    cal: sumField(receiptItems, "cal"),
    added_sugar_g: sumField(receiptItems, "added_sugar_g"),
  };
  const pantryTotals = {
    protein_g: sumField(pantryItems, "protein_g"),
    cal: sumField(pantryItems, "cal"),
    added_sugar_g: sumField(pantryItems, "added_sugar_g"),
  };
  const combined = {
    protein_g: receiptTotals.protein_g + pantryTotals.protein_g,
    cal: receiptTotals.cal + pantryTotals.cal,
    added_sugar_g: receiptTotals.added_sugar_g + pantryTotals.added_sugar_g,
  };

  const familyDaily = profiles.reduce(
    (a, p) => {
      const t = effectiveTargets(p);
      return {
        protein_g: a.protein_g + t.protein_g,
        cal: a.cal + t.cal,
        added_sugar_g: a.added_sugar_g + t.added_sugar_g,
      };
    },
    { protein_g: 0, cal: 0, added_sugar_g: 0 }
  );
  const familyForDays = {
    protein_g: familyDaily.protein_g * days,
    cal: familyDaily.cal * days,
    added_sugar_g: familyDaily.added_sugar_g * days,
  };

  return (
    <div className="p-5 flex-1 overflow-y-auto">
      <h1 className="font-display italic text-[26px] leading-snug mb-2">
        {readout.verdict_headline}
      </h1>
      <p className="text-xs text-muted mb-5">{readout.subtitle}</p>

      <div className="grid grid-cols-2 gap-2 mb-7">
        <FractionTile
          label="Protein"
          ok={proteinOk}
          covered={proteinDays}
          target={days}
          sub="days covered"
        />
        <Tile
          label="Added sugar"
          ok={!sugarOver}
          primary={`${pctSugar}%`}
          sub="of your limit"
        />
      </div>

      {readout.best_picks.length > 0 && (
        <section className="mb-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-good font-bold mb-3">
            Best picks
          </div>
          <div className="space-y-2">
            {readout.best_picks.map((p, i) => (
              <div
                key={i}
                className={`rounded-xl p-4 flex items-start justify-between gap-3 ${
                  p.gap_closer
                    ? "bg-goodSoft border-2 border-good/60"
                    : i === 0
                    ? "bg-goodSoft border border-good/40"
                    : "bg-card border border-border"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{p.item}</div>
                  <div className="text-xs text-muted mt-1 leading-snug">
                    {p.note}
                  </div>
                  {p.gap_closer && (
                    <div className="mt-2 leading-snug">
                      <div className="text-xs text-muted">
                        Short {p.gap_closer.short_by_g}g of protein.
                      </div>
                      <div className="text-xs font-semibold text-accent mt-0.5">
                        → {p.gap_closer.action_text}
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-display text-2xl text-good leading-none">
                    {p.protein_g}g
                  </div>
                  <div className="text-[10px] text-muted mt-0.5">protein</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {readout.best_picks.length > 0 && readout.sugar_hiding.length > 0 && (
        <div className="border-t border-border mb-6" />
      )}

      {readout.sugar_hiding.length > 0 && (
        <section className="mb-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-bad font-bold mb-3">
            Where the added sugar is hiding
          </div>
          <div className="space-y-2">
            {readout.sugar_hiding.map((s, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="font-semibold text-sm flex-1 min-w-0">
                    {s.item}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display text-2xl text-bad leading-none">
                      {s.added_sugar_g}g
                    </div>
                    <div className="text-[10px] text-muted mt-0.5">
                      added sugar
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted leading-snug">{s.why}</div>
                {s.fix?.kind === "swap" && (
                  <div className="mt-2 text-xs text-accent font-semibold leading-snug">
                    → {s.fix.text}
                  </div>
                )}
                {s.fix?.kind === "aside" && (
                  <div className="mt-2 text-xs italic text-warn leading-snug">
                    {s.fix.text}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {readout.confidence_footnote && (
        <p className="text-xs italic text-muted mb-4">
          {readout.confidence_footnote}
        </p>
      )}

      <div className="border-t border-border pt-4 mb-3">
        <button
          onClick={() => setShowItems((v) => !v)}
          className="w-full text-left text-xs font-semibold uppercase tracking-wider text-muted flex justify-between"
        >
          <span>Item breakdown</span>
          <span>{showItems ? "–" : "+"}</span>
        </button>
        {showItems && (
          <div className="mt-3 space-y-4">
            <ItemGroup
              title={`From ${store}`}
              items={receiptItems}
              totals={receiptTotals}
            />
            {pantryItems.length > 0 && (
              <ItemGroup
                title="From pantry"
                items={pantryItems}
                totals={pantryTotals}
              />
            )}
            <div className="bg-card border border-border rounded-xl p-3 text-xs">
              <div className="font-semibold mb-1">Combined totals</div>
              <Row label="Protein" value={`${combined.protein_g} g`} />
              <Row label="Calories" value={`${combined.cal}`} />
              <Row label="Added sugar" value={`${combined.added_sugar_g} g`} />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4 mb-3">
        <button
          onClick={() => setShowTargets((v) => !v)}
          className="w-full text-left text-xs font-semibold uppercase tracking-wider text-muted flex justify-between"
        >
          <span>Per-person targets</span>
          <span>{showTargets ? "–" : "+"}</span>
        </button>
        {showTargets && (
          <div className="mt-3 space-y-3">
            {profiles.map((p, i) => {
              const eff = effectiveTargets(p);
              const exp = explainTargets(p);
              return (
                <div key={i} className="bg-card border border-border rounded-xl p-3 text-xs">
                  <div className="font-semibold mb-1">
                    {p.name ?? `Person ${i + 1}`}{" "}
                    <span className="text-muted font-normal">· age {p.age}</span>
                  </div>
                  <Row
                    label="Protein"
                    value={`${eff.protein_g} g/day`}
                    sub={exp.protein_why}
                  />
                  <Row label="Calories" value={`${eff.cal}/day`} sub={exp.cal_why} />
                  <Row
                    label="Added sugar ceiling"
                    value={`${eff.added_sugar_g} g/day`}
                    sub={exp.added_sugar_why}
                  />
                </div>
              );
            })}
            <div className="bg-accentSoft border border-accent/20 rounded-xl p-3 text-xs">
              <div className="font-semibold mb-1">
                Family total for {days} day{days === 1 ? "" : "s"}
              </div>
              <Row
                label="Protein"
                value={`${familyForDays.protein_g} g`}
                sub={`${familyDaily.protein_g} g/day × ${days}`}
              />
              <Row
                label="Calories"
                value={`${familyForDays.cal}`}
                sub={`${familyDaily.cal}/day × ${days}`}
              />
              <Row
                label="Added sugar ceiling"
                value={`${familyForDays.added_sugar_g} g`}
                sub={`${familyDaily.added_sugar_g} g/day × ${days}`}
              />
            </div>
            <p className="text-[10px] text-muted italic">
              Sources: USDA DRI (protein, calories). AHA / USDA (added sugar).
            </p>
          </div>
        )}
      </div>

      <div className="text-center mt-6">
        <button className="btn-ghost" onClick={onRestart}>
          Start over
        </button>
      </div>
    </div>
  );
}

function Tile({
  label,
  ok,
  primary,
  sub,
}: {
  label: string;
  ok: boolean;
  primary: string;
  sub: string;
}) {
  return (
    <div
      className={`rounded-xl p-3 border text-center ${
        ok ? "bg-card border-border" : "bg-badSoft border-bad/40"
      }`}
    >
      <div className="text-[9px] uppercase tracking-wider text-muted mb-1">
        {label}
      </div>
      <div
        className={`font-display leading-none h-10 flex items-center justify-center ${
          ok ? "text-good" : "text-bad"
        }`}
      >
        <span className="text-2xl">{primary}</span>
      </div>
      <div className="text-[10px] text-muted mt-1">{sub}</div>
    </div>
  );
}

function FractionTile({
  label,
  ok,
  covered,
  target,
  sub,
}: {
  label: string;
  ok: boolean;
  covered: number;
  target: number;
  sub: string;
}) {
  return (
    <div
      className={`rounded-xl p-3 border text-center ${
        ok ? "bg-card border-border" : "bg-badSoft border-bad/40"
      }`}
    >
      <div className="text-[9px] uppercase tracking-wider text-muted mb-1">
        {label}
      </div>
      <div
        className={`font-display leading-none h-10 flex items-baseline justify-center ${
          ok ? "text-good" : "text-bad"
        }`}
      >
        <span className="text-4xl">{covered}</span>
        <span className="text-base text-muted">/{target}</span>
      </div>
      <div className="text-[10px] text-muted mt-1">{sub}</div>
    </div>
  );
}

function Row({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex justify-between items-baseline py-0.5">
      <div>
        <div>{label}</div>
        {sub && <div className="text-[10px] text-muted">{sub}</div>}
      </div>
      <div className="font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ItemGroup({
  title,
  items,
  totals,
}: {
  title: string;
  items: (NutritionItem | PantryItem)[];
  totals: { protein_g: number; cal: number; added_sugar_g: number };
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex justify-between items-center">
        <span className="text-[10px] uppercase tracking-wider text-accent font-bold">
          {title}
        </span>
        <span className="text-[11px] text-muted">{items.length} items</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] text-[10px] px-3 py-1 text-muted uppercase tracking-wider gap-x-3">
        <span>Item</span>
        <span className="text-right">P</span>
        <span className="text-right">cal</span>
        <span className="text-right">sug</span>
      </div>
      {items.map((it, i) => {
        const highSugar = it.added_sugar_g >= 25;
        return (
          <div
            key={i}
            className={`grid grid-cols-[1fr_auto_auto_auto] text-xs px-3 py-1.5 gap-x-3 border-t border-border ${
              highSugar ? "bg-badSoft" : ""
            }`}
          >
            <span className="truncate">{it.name}</span>
            <span className="text-right tabular-nums">{Math.round(it.protein_g)}</span>
            <span className="text-right tabular-nums">{Math.round(it.cal)}</span>
            <span
              className={`text-right tabular-nums ${highSugar ? "text-bad font-semibold" : ""}`}
            >
              {Math.round(it.added_sugar_g)}
            </span>
          </div>
        );
      })}
      <div className="grid grid-cols-[1fr_auto_auto_auto] text-xs px-3 py-2 gap-x-3 border-t border-border bg-chatBg font-semibold">
        <span>Total</span>
        <span className="text-right tabular-nums">{totals.protein_g}</span>
        <span className="text-right tabular-nums">{totals.cal}</span>
        <span className="text-right tabular-nums">{totals.added_sugar_g}</span>
      </div>
    </div>
  );
}
