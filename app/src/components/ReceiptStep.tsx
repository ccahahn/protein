"use client";
import { useRef, useState } from "react";
import { Bubble } from "./Bubble";
import { Spinner } from "./Spinner";
import { compressImage } from "@/lib/compress-image";
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

type Props = {
  onComplete: (data: { store: string; items: NutritionItem[] }) => void;
};

export function ReceiptStep({ onComplete }: Props) {
  const [phase, setPhase] = useState<"upload" | "scanning" | "parsed" | "error">("upload");
  const [error, setError] = useState<string | null>(null);
  const [store, setStore] = useState<string>("");
  const [items, setItems] = useState<NutritionItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rejectIfVideo = (file: File): string | null => {
    // `accept="image/*"` is a hint, not a guarantee — Android pickers can
    // still hand us a video file. Same for drag-and-drop. Reject anything
    // whose mime type starts with 'video/' or is a known video extension.
    const type = (file.type || "").toLowerCase();
    const name = file.name.toLowerCase();
    const looksLikeVideo =
      type.startsWith("video/") ||
      /\.(mp4|mov|avi|mkv|webm|m4v|3gp)$/i.test(name);
    if (looksLikeVideo) {
      return "That looks like a video. Please upload a photo of the receipt.";
    }
    // Empty mime is common on some Android pickers — allow it; if the
    // decode fails downstream we'll surface a clear message then.
    if (type && !type.startsWith("image/")) {
      return "That doesn't look like an image. Please upload a photo of the receipt.";
    }
    return null;
  };

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
    const videoError = rejectIfVideo(file);
    if (videoError) {
      setError(videoError);
      setPhase("error");
      return;
    }
    setPhase("scanning");
    setError(null);
    try {
      // Compress client-side first. Samsung Motion Photos and raw camera
      // shots can be 20MB+, and Vercel caps the serverless request body at
      // ~4.5MB. Compressing to max 2000px JPEG at 85% keeps us well under.
      let blob: Blob;
      try {
        blob = await compressImage(file);
      } catch {
        setError(
          "Couldn't read that file as an image. Please upload a photo of the receipt."
        );
        setPhase("error");
        return;
      }
      const compressed =
        blob instanceof File
          ? blob
          : new File([blob], "receipt.jpg", { type: "image/jpeg" });

      const fd = new FormData();
      fd.append("image", compressed);
      const res = await fetch("/api/receipt", { method: "POST", body: fd });

      // Read body as text first so a non-JSON error (like Vercel's "Request
      // Entity Too Large" plaintext) doesn't blow up JSON.parse.
      const rawText = await res.text();
      let data: {
        error?: string;
        unreadable?: boolean;
        notes?: string | null;
        store?: string;
        items?: NutritionItem[];
      } | null = null;
      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        throw new Error(
          `Server returned ${res.status}: ${rawText.slice(0, 120)}`
        );
      }
      if (!res.ok || data?.error) throw new Error(data?.error ?? "failed");
      if (data?.unreadable) {
        setError(data.notes ?? "Couldn't read that. Try again?");
        setPhase("error");
        return;
      }
      setStore(data?.store ?? "");
      setItems(data?.items ?? []);
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
            I&apos;ll point out your best protein picks and where the added
            sugar is hiding, in about 30 seconds.
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
              if (f) upload(f);
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
        </>
      )}

      {phase === "scanning" && <Spinner label="Reading receipt…" />}

      {phase === "parsed" && (
        <>
          <Bubble>
            {items.length} items from <strong>{store}</strong>.
            {items.filter((i) => i.confidence === "low").length > 0 && (
              <>
                {" "}
                {items.filter((i) => i.confidence === "low").length}{" "}
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
                    {it.confidence === "low" && (
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

          <div className="text-center mt-4">
            <button
              className="btn-primary"
              onClick={() => onComplete({ store, items })}
            >
              See the readout →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
