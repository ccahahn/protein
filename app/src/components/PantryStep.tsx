"use client";
import { useState } from "react";
import { Bubble } from "./Bubble";
import { Spinner } from "./Spinner";
import { VoiceRecorder } from "./VoiceRecorder";
import type { PantryItem } from "@/lib/types";

type Props = {
  onComplete: (items: PantryItem[]) => void;
};

export function PantryStep({ onComplete }: Props) {
  const [phase, setPhase] = useState<"ask" | "parsing" | "done" | "error">("ask");
  const [items, setItems] = useState<PantryItem[]>([]);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingIdx, setSavingIdx] = useState<number | null>(null);

  const startEdit = (i: number) => {
    setEditingIdx(i);
    setEditDraft(`${items[i].qty_estimate} ${items[i].name}`);
  };
  const cancelEdit = () => {
    setEditingIdx(null);
    setEditDraft("");
  };
  const saveEdit = async (i: number) => {
    const descriptor = editDraft.trim();
    if (!descriptor) {
      cancelEdit();
      return;
    }
    setSavingIdx(i);
    try {
      const res = await fetch("/api/pantry/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descriptor }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "failed");
      const parsed: PantryItem[] = data.items ?? [];
      if (parsed.length === 0) {
        cancelEdit();
        return;
      }
      const next = [...items];
      next.splice(i, 1, ...parsed);
      setItems(next);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingIdx(null);
      cancelEdit();
    }
  };
  const removeItem = (i: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleRecording = async (blob: Blob, mime: string) => {
    setPhase("parsing");
    try {
      const fd = new FormData();
      fd.append("audio", new File([blob], "pantry.webm", { type: mime }));
      const res = await fetch("/api/pantry", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "failed");
      setTranscript(data.transcript ?? "");
      setItems(data.items ?? []);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "pantry failed");
      setPhase("error");
    }
  };

  return (
    <div className="p-5 flex-1 overflow-y-auto">
      <Bubble>
        Anything at home I should count — <em>from before this trip</em>? Fridge, freezer,
        pantry. Don&apos;t re-list the bags you just unpacked.
      </Bubble>

      {phase === "ask" && (
        <>
          <VoiceRecorder
            onRecorded={handleRecording}
            prompt="Tap and describe what you already had"
          />
          <div className="text-center mt-4">
            <button className="btn-ghost" onClick={() => onComplete([])}>
              Skip — just use the receipt
            </button>
          </div>
        </>
      )}

      {phase === "parsing" && <Spinner label="Parsing pantry…" />}

      {phase === "done" && (
        <>
          {transcript && (
            <div className="mb-4 text-xs italic text-muted px-2">
              &quot;{transcript}&quot;
            </div>
          )}
          <Bubble>
            Got {items.length} {items.length === 1 ? "item" : "items"}. Tap any to fix it.
          </Bubble>
          <div className="flex flex-col gap-2 my-4">
            {items.map((it, i) => {
              if (editingIdx === i) {
                return (
                  <div
                    key={i}
                    className="bg-accentSoft border border-accent rounded-xl p-3 flex items-center gap-2"
                  >
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(i);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      placeholder="e.g. 2 half-gallons whole milk"
                      className="flex-1 text-sm bg-card border border-border rounded px-2 py-1"
                    />
                    <button
                      onClick={() => saveEdit(i)}
                      disabled={savingIdx === i}
                      className="text-xs text-accent font-semibold disabled:opacity-50"
                    >
                      {savingIdx === i ? "…" : "save"}
                    </button>
                    <button onClick={cancelEdit} className="text-xs text-muted">
                      cancel
                    </button>
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className="bg-card border border-border rounded-xl px-3 py-2 flex items-center justify-between"
                >
                  <button
                    onClick={() => startEdit(i)}
                    className="flex-1 text-left text-xs"
                  >
                    <span className="font-semibold">{it.name}</span>
                    <span className="text-muted"> · {it.qty_estimate}</span>
                    {it.confidence !== "high" && (
                      <span className="text-warn ml-1">⚠</span>
                    )}
                  </button>
                  <button
                    onClick={() => removeItem(i)}
                    className="text-muted text-xs px-2"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-4">
            <button className="btn-primary" onClick={() => onComplete(items)}>
              Next →
            </button>
          </div>
        </>
      )}

      {phase === "error" && (
        <>
          <p className="text-bad text-sm text-center my-4">{error}</p>
          <div className="text-center">
            <button className="btn-ghost" onClick={() => onComplete([])}>
              Skip pantry
            </button>
          </div>
        </>
      )}
    </div>
  );
}
