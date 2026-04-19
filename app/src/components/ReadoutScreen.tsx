"use client";
import { useState } from "react";
import type { NutritionItem, ReadoutOutput } from "@/lib/types";

type Props = {
  readout: ReadoutOutput;
  receiptItems: NutritionItem[];
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
  store,
  onRestart,
}: Props) {
  const [showItems, setShowItems] = useState(false);

  const receiptTotals = {
    protein_g: sumField(receiptItems, "protein_g"),
    cal: sumField(receiptItems, "cal"),
    added_sugar_g: sumField(receiptItems, "added_sugar_g"),
  };

  return (
    <div className="p-5 flex-1 overflow-y-auto">
      <h1 className="font-display italic text-[26px] leading-snug mb-2">
        {readout.verdict_headline}
      </h1>
      <p className="text-xs text-muted mb-5">{readout.subtitle}</p>

      <div className="grid grid-cols-2 gap-2 mb-7">
        <TotalTile
          label="Protein"
          value={readout.totals.protein_g}
          perServing={readout.per_serving?.protein_g}
          tone="good"
        />
        <TotalTile
          label="Added sugar"
          value={readout.totals.added_sugar_g}
          perServing={readout.per_serving?.added_sugar_g}
          tone={readout.sugar_hiding.length > 0 ? "bad" : "neutral"}
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
                  i === 0
                    ? "bg-goodSoft border border-good/40"
                    : "bg-card border border-border"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{p.item}</div>
                  <div className="text-xs text-muted mt-1 leading-snug">
                    {p.note}
                  </div>
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

function TotalTile({
  label,
  value,
  perServing,
  tone,
}: {
  label: string;
  value: number;
  perServing?: number;
  tone: "good" | "bad" | "neutral";
}) {
  const bg =
    tone === "bad" ? "bg-badSoft border-bad/40" : "bg-card border-border";
  const text =
    tone === "bad" ? "text-bad" : tone === "good" ? "text-good" : "text-ink";
  return (
    <div className={`rounded-xl p-3 border text-center ${bg}`}>
      <div className="text-[9px] uppercase tracking-wider text-muted mb-1">
        {label}
      </div>
      <div
        className={`font-display leading-none h-10 flex items-baseline justify-center ${text}`}
      >
        <span className="text-4xl">{value}</span>
        <span className="text-xl">g</span>
      </div>
      <div className="text-[10px] text-muted mt-1">
        {typeof perServing === "number"
          ? `${perServing}g per serving`
          : "total"}
      </div>
    </div>
  );
}

function ItemGroup({
  title,
  items,
  totals,
}: {
  title: string;
  items: NutritionItem[];
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
