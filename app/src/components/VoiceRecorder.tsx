"use client";
import { useEffect, useRef, useState } from "react";

type Props = {
  onRecorded: (blob: Blob, mimeType: string) => void;
  prompt: string;
  recording_label?: string;
};

export function VoiceRecorder({ onRecorded, prompt, recording_label }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const start = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        stream.getTracks().forEach((t) => t.stop());
        setState("done");
        onRecorded(blob, mime);
      };
      rec.start();
      setState("recording");
    } catch (e) {
      setError(e instanceof Error ? e.message : "mic failed");
    }
  };

  const stop = () => {
    mediaRef.current?.stop();
  };

  if (state === "idle") {
    return (
      <div className="text-center my-6">
        <button
          onClick={start}
          className="w-20 h-20 rounded-full bg-accent text-white text-3xl shadow-lg"
          aria-label="Start recording"
        >
          🎙
        </button>
        <p className="mt-3 text-sm text-muted">{prompt}</p>
        {error && <p className="mt-2 text-xs text-bad">{error}</p>}
      </div>
    );
  }
  if (state === "recording") {
    return (
      <div className="text-center my-6">
        <button
          onClick={stop}
          className="w-20 h-20 rounded-full bg-bad text-white text-2xl mic-pulse"
          aria-label="Stop recording"
        >
          ■
        </button>
        <p className="mt-3 text-sm text-muted">
          {recording_label ?? "Listening… tap to stop"}
        </p>
      </div>
    );
  }
  return <Spinner label="Parsing…" />;
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="text-center my-6">
      <div className="w-7 h-7 rounded-full border-[3px] border-border border-t-accent mx-auto mb-3 spinner" />
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
