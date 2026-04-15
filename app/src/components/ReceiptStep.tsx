"use client";
import { useRef, useState } from "react";
import { Bubble } from "./Bubble";
import { Spinner } from "./Spinner";
import type { NutritionItem } from "@/lib/types";

function CameraIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function StepDot({
  n,
  label,
  active = false,
}: {
  n: number;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${
          active
            ? "bg-accent text-white"
            : "bg-card border border-border text-muted"
        }`}
      >
        {n}
      </div>
      <div
        className={`text-[10px] leading-none ${
          active ? "text-ink font-semibold" : "text-muted"
        }`}
      >
        {label}
      </div>
    </div>
  );
}

type Props = {
  onComplete: (data: { store: string; items: NutritionItem[]; days: number }) => void;
};

export function ReceiptStep({ onComplete }: Props) {
  const [phase, setPhase] = useState<"upload" | "scanning" | "parsed" | "error">("upload");
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<string>("");
  const [items, setItems] = useState<NutritionItem[]>([]);
  const [days, setDays] = useState(5);
  const [dragOver, setDragOver] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const startEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditDraft(items[idx].name);
  };
  const cancelEdit = () => {
    setEditingIdx(null);
    setEditDraft("");
  };
  const saveEdit = async (idx: number) => {
    const newName = editDraft.trim();
    if (!newName || newName === items[idx].name) {
      cancelEdit();
      return;
    }
    setSavingIdx(idx);
    try {
      const res = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store,
          items: [{ name: newName, qty: items[idx].qty }],
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "failed");
      const updated = [...items];
      updated[idx] = data.items[0];
      setItems(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingIdx(null);
      cancelEdit();
    }
  };

  const upload = async (file: File) => {
    setPhase("scanning");
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/receipt", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "failed");
      if (data.unreadable) {
        setError(data.notes ?? "Couldn't read that. Try again?");
        setPhase("error");
        return;
      }
      setStore(data.store);
      setItems(data.items);
      setPhase("parsed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
      setPhase("error");
    }
  };

  return (
    <div className="p-5 flex-1 overflow-y-auto">
      {(phase === "upload" || phase === "error") && (
        <>
          <h1 className="font-display italic text-3xl text-center mt-4 mb-3">
            Snap your receipt.
          </h1>
          <p className="text-sm text-muted text-center mb-8 px-2 leading-relaxed">
            I&apos;ll tell you if you bought enough protein, too much sugar, and
            what to swap in about 30 seconds.
          </p>

          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f && f.type.startsWith("image/")) upload(f);
              else setError("Drop an image file (jpg or png).");
            }}
            className={`border-2 border-dashed rounded-xl py-10 px-6 text-center cursor-pointer transition ${
              dragOver ? "border-accent bg-accentSoft" : "border-border hover:border-accent"
            }`}
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-accentSoft text-accent mb-3">
              <CameraIcon />
            </div>
            <p className="text-base font-semibold">Take a photo or upload</p>
            <p className="text-xs text-muted mt-1">
              Trader Joe&apos;s, Costco, Whole Foods, any store
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          {phase === "error" && (
            <p className="mt-4 text-sm text-bad text-center">{error}</p>
          )}

          <div className="flex items-center justify-center gap-6 mt-10 mb-2">
            <StepDot n={1} label="Scan receipt" active />
            <StepDot n={2} label="Say who's eating" />
            <StepDot n={3} label="Get the verdict" />
          </div>
        </>
      )}

      {phase === "scanning" && <Spinner label="Reading receipt…" />}

      {phase === "parsed" && (
        <>
          <Bubble>
            {items.length} items from <strong>{store}</strong>.
            {items.filter((i) => i.confidence !== "high").length > 0 && (
              <>
                {" "}
                {items.filter((i) => i.confidence !== "high").length}{" "}
                I&apos;m less sure about (⚠).
              </>
            )}
          </Bubble>

          <div className="bg-card border border-border rounded-xl overflow-hidden mb-5 max-h-64 overflow-y-auto">
            <div className="px-4 py-2 border-b border-border flex items-center gap-2">
              <span className="text-[10px] font-bold text-accent bg-accentSoft px-2 py-0.5 rounded-full uppercase tracking-wider">
                {store}
              </span>
              <span className="text-[11px] text-muted">{items.length} items</span>
            </div>
            {items.map((it, i) => {
              const isEditing = editingIdx === i;
              const isSaving = savingIdx === i;
              if (isEditing) {
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-4 py-2 border-t border-border first:border-t-0 bg-accentSoft"
                  >
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(i);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="flex-1 text-sm bg-card border border-border rounded px-2 py-1"
                    />
                    <button
                      onClick={() => saveEdit(i)}
                      disabled={isSaving}
                      className="text-xs text-accent font-semibold disabled:opacity-50"
                    >
                      {isSaving ? "…" : "save"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="text-xs text-muted"
                    >
                      cancel
                    </button>
                  </div>
                );
              }
              return (
                <button
                  key={i}
                  onClick={() => startEdit(i)}
                  className="w-full flex items-center justify-between px-4 py-2 border-t border-border first:border-t-0 text-left hover:bg-chatBg"
                >
                  <span className="text-sm flex-1 truncate flex items-center gap-1">
                    {it.name}
                    {it.confidence !== "high" && (
                      <span className="text-warn text-xs">⚠</span>
                    )}
                  </span>
                  <span className="text-xs text-muted ml-2">×{it.qty}</span>
                </button>
              );
            })}
            <div className="px-4 py-2 text-[11px] text-muted italic border-t border-border">
              Tap any item to correct its name.
            </div>
          </div>

          <Bubble>How many days should this cover?</Bubble>
          <div className="flex items-center justify-center gap-5 my-6">
            <button
              onClick={() => setDays(Math.max(1, days - 1))}
              className="w-10 h-10 rounded-full border border-border bg-card text-lg"
            >
              −
            </button>
            <span className="font-display text-5xl min-w-[60px] text-center">
              {days}
            </span>
            <button
              onClick={() => setDays(Math.min(14, days + 1))}
              className="w-10 h-10 rounded-full border border-border bg-card text-lg"
            >
              +
            </button>
          </div>

          <div className="text-center">
            <button
              className="btn-primary"
              onClick={() => onComplete({ store, items, days })}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
