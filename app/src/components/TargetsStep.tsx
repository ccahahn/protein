"use client";
import { useMemo, useState } from "react";
import { Bubble } from "./Bubble";
import { effectiveTargets, explainTargets } from "@/lib/client-dri";
import type { Profile } from "@/lib/types";

type Props = {
  profiles: Profile[];
  acknowledgedIgnored?: string[] | null;
  onComplete: (profiles: Profile[]) => void;
};

type EditTarget =
  | { idx: number; field: "protein" }
  | { idx: number; field: "cal" }
  | { idx: number; field: "weight" };

function calWarning(
  age: number,
  derived: number,
  effective: number
): string | null {
  // Likely typo — way below any plausible target.
  if (effective < 800) {
    return "That looks like a typo. Check the number — 200 vs 2000?";
  }
  // Absolute floor for any adult without medical supervision.
  if (effective < 1200) {
    return "Very low for anyone. Don't drop calories this far without a doctor.";
  }
  // Minors get a stricter floor: anything below ~85% of the DRI is
  // pediatric territory regardless of what an adult would tolerate.
  if (age < 18 && effective < derived * 0.85) {
    if (age < 16) {
      return "Below the DRI for this age. Kids need the energy to grow — talk to a pediatrician before overriding.";
    }
    return "Below the DRI for this age. Teens shouldn't be on calorie restriction without a pediatrician.";
  }
  // Generic low flag for adults — noticeably below DRI.
  if (effective < derived * 0.7) {
    return "Notably below the DRI. Double-check before proceeding.";
  }
  return null;
}

function proteinWarning(
  derived: number,
  effective: number
): string | null {
  if (effective < derived * 0.5) {
    return "Very low protein — likely a typo.";
  }
  return null;
}

export function TargetsStep({
  profiles,
  acknowledgedIgnored,
  onComplete,
}: Props) {
  const [state, setState] = useState<Profile[]>(profiles);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [draft, setDraft] = useState("");

  const derived = useMemo(() => state.map(explainTargets), [state]);
  const eff = useMemo(() => state.map(effectiveTargets), [state]);

  const totals = eff.reduce(
    (a, t) => ({
      protein_g: a.protein_g + t.protein_g,
      cal: a.cal + t.cal,
      added_sugar_g: a.added_sugar_g + t.added_sugar_g,
    }),
    { protein_g: 0, cal: 0, added_sugar_g: 0 }
  );

  const startEdit = (e: EditTarget) => {
    setEditing(e);
    if (e.field === "protein") setDraft(String(eff[e.idx].protein_g));
    else if (e.field === "cal") setDraft(String(eff[e.idx].cal));
    else {
      const kg = state[e.idx].weight_kg;
      setDraft(kg ? String(Math.round(kg * 2.205)) : "");
    }
  };

  const saveEdit = () => {
    if (!editing) return;
    const n = parseFloat(draft);
    if (isNaN(n) || n <= 0) {
      setEditing(null);
      return;
    }
    const next = [...state];
    const p = { ...next[editing.idx] };
    if (editing.field === "protein") {
      p.protein_target_override = Math.round(n);
    } else if (editing.field === "cal") {
      p.cal_target_override = Math.round(n);
    } else if (editing.field === "weight") {
      // Input is lbs; store kg. Leave any existing manual overrides alone —
      // explicit user edits win until the user hits reset.
      p.weight_kg = n / 2.205;
    }
    next[editing.idx] = p;
    setState(next);
    setEditing(null);
  };

  const toggleSex = (idx: number) => {
    const next = [...state];
    const p = { ...next[idx] };
    if (p.age < 16) return;
    p.sex = p.sex === "M" ? "F" : "M";
    // Do NOT wipe manual overrides — explicit user edits win. User can hit
    // reset on a target if they want the derived value back.
    next[idx] = p;
    setState(next);
  };
  const toggleWeightLoss = (idx: number) => {
    const next = [...state];
    const p = { ...next[idx] };
    if (p.age < 16) return;
    p.weightLossGoal = !p.weightLossGoal;
    next[idx] = p;
    setState(next);
  };
  const toggleHideWeight = (idx: number) => {
    const next = [...state];
    const p = { ...next[idx] };
    p.hide_weight = !p.hide_weight;
    next[idx] = p;
    setState(next);
  };
  const resetOverride = (idx: number, field: "protein" | "cal") => {
    const next = [...state];
    const p = { ...next[idx] };
    if (field === "protein") delete p.protein_target_override;
    else delete p.cal_target_override;
    next[idx] = p;
    setState(next);
  };

  return (
    <div className="p-5 flex-1 overflow-y-auto">
      <Bubble>
        Here&apos;s who I heard and what I think each person needs per day. Tap anything
        to correct it.
      </Bubble>

      <div className="space-y-3 my-4">
        {state.map((p, i) => {
          const exp = derived[i];
          const t = eff[i];
          const isChild = p.age < 16;
          const weight_lb = p.weight_kg ? Math.round(p.weight_kg * 2.205) : null;
          const proteinOverridden = p.protein_target_override != null;
          const calOverridden = p.cal_target_override != null;

          return (
            <div key={i} className="bg-card border border-border rounded-xl p-4 text-sm">
              <div className="font-semibold mb-1">
                {p.name ?? `Person ${i + 1}`}{" "}
                <span className="text-muted font-normal">· age {p.age}</span>
              </div>

              {!isChild && (
                <div className="text-xs text-muted mb-3 flex flex-wrap gap-x-3 gap-y-1 items-center">
                  <button onClick={() => toggleSex(i)} className="underline">
                    {p.sex ?? "?"}
                  </button>
                  {editing?.idx === i && editing.field === "weight" ? (
                    <span className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") setEditing(null);
                        }}
                        onBlur={saveEdit}
                        className="w-16 bg-accentSoft border border-accent rounded px-1"
                      />{" "}
                      lb
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit({ idx: i, field: "weight" })}
                        className="underline"
                      >
                        {weight_lb
                          ? p.hide_weight
                            ? "••• lb"
                            : `${weight_lb} lb`
                          : "no weight, tap"}
                      </button>
                      {weight_lb && (
                        <button
                          onClick={() => toggleHideWeight(i)}
                          className="text-muted hover:text-ink leading-none p-0.5"
                          title={p.hide_weight ? "Show weight" : "Hide weight"}
                          aria-label={
                            p.hide_weight ? "Show weight" : "Hide weight"
                          }
                        >
                          {p.hide_weight ? <EyeOffIcon /> : <EyeIcon />}
                        </button>
                      )}
                    </span>
                  )}
                  <button
                    onClick={() => toggleWeightLoss(i)}
                    className="underline"
                  >
                    weight-loss: {p.weightLossGoal ? "on" : "off"}
                  </button>
                </div>
              )}
              {p.locked_reason && (
                <div className="text-[11px] text-warn italic mb-2">
                  {p.locked_reason}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 mt-2">
                <TargetCell
                  label="Protein"
                  value={`${t.protein_g} g`}
                  why={exp.protein_why}
                  edited={proteinOverridden}
                  editing={editing?.idx === i && editing.field === "protein"}
                  draft={draft}
                  onStart={() => startEdit({ idx: i, field: "protein" })}
                  onDraft={setDraft}
                  onSave={saveEdit}
                  onCancel={() => setEditing(null)}
                  onReset={
                    proteinOverridden ? () => resetOverride(i, "protein") : null
                  }
                />
                <TargetCell
                  label="Calories"
                  value={`${t.cal}`}
                  why={exp.cal_why}
                  edited={calOverridden}
                  editing={editing?.idx === i && editing.field === "cal"}
                  draft={draft}
                  onStart={() => startEdit({ idx: i, field: "cal" })}
                  onDraft={setDraft}
                  onSave={saveEdit}
                  onCancel={() => setEditing(null)}
                  onReset={
                    calOverridden ? () => resetOverride(i, "cal") : null
                  }
                />
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted">
                    Added sugar
                  </div>
                  <div className="font-display text-lg">{t.added_sugar_g} g</div>
                  <div className="text-[11px] text-muted mt-0.5">
                    {exp.added_sugar_why}
                  </div>
                </div>
              </div>
              {(() => {
                const calWarn = calWarning(p.age, exp.cal, t.cal);
                const proWarn = proteinWarning(exp.protein_g, t.protein_g);
                if (!calWarn && !proWarn) return null;
                return (
                  <div className="mt-3 bg-warnSoft border border-warn/40 rounded-lg p-3 text-[11px] text-ink">
                    <div className="font-semibold text-warn mb-1">
                      ⚠ Heads up
                    </div>
                    {calWarn && <div>{calWarn}</div>}
                    {proWarn && <div className="mt-1">{proWarn}</div>}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      <div className="bg-accentSoft border border-accent/30 rounded-xl p-4 mb-4 text-xs">
        <div className="font-semibold mb-1">Family daily targets</div>
        <div>
          Protein: <strong>{totals.protein_g} g</strong> · Calories:{" "}
          <strong>{totals.cal}</strong> · Added sugar ceiling:{" "}
          <strong>{totals.added_sugar_g} g</strong>
        </div>
        <div className="text-muted mt-2 text-[11px]">
          Added sugar comes from AHA guidance: 25 g/day for women and kids, 36 g/day for
          men. Flat by sex — not edited here.
        </div>
      </div>

      {acknowledgedIgnored && acknowledgedIgnored.length > 0 && (
        <div className="text-xs italic text-muted px-2 mb-3">
          {acknowledgedIgnored.join(" ")}
        </div>
      )}

      <div className="text-center">
        <button className="btn-primary" onClick={() => onComplete(state)}>
          Looks right — get the readout →
        </button>
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}

function TargetCell({
  label,
  value,
  why,
  edited,
  editing,
  draft,
  onStart,
  onDraft,
  onSave,
  onCancel,
  onReset,
}: {
  label: string;
  value: string;
  why: string;
  edited: boolean;
  editing: boolean;
  draft: string;
  onStart: () => void;
  onDraft: (s: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: (() => void) | null;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave();
            if (e.key === "Escape") onCancel();
          }}
          onBlur={onSave}
          className="w-full font-display text-lg bg-accentSoft border border-accent rounded px-2 py-1"
        />
      ) : (
        <button onClick={onStart} className="font-display text-lg text-left">
          {value}
          {edited && (
            <span className="text-[10px] text-accent ml-1">(edited)</span>
          )}
        </button>
      )}
      <div className="text-[11px] text-muted mt-0.5">{why}</div>
      {onReset && (
        <button
          onClick={onReset}
          className="text-[10px] text-muted underline mt-1"
        >
          reset
        </button>
      )}
    </div>
  );
}
