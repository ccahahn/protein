"use client";
import { useState } from "react";
import { Bubble } from "./Bubble";
import { Spinner } from "./Spinner";
import { VoiceRecorder } from "./VoiceRecorder";
import type { Profile } from "@/lib/types";

type Props = {
  onComplete: (profiles: Profile[], acknowledgedIgnored: string[]) => void;
};

export function HouseholdStep({ onComplete }: Props) {
  const [phase, setPhase] = useState<"ask" | "parsing" | "error">("ask");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleRecording = async (blob: Blob, mime: string) => {
    setPhase("parsing");
    try {
      const fd = new FormData();
      fd.append("audio", new File([blob], "household.webm", { type: mime }));
      if (profiles.length) fd.append("priorProfiles", JSON.stringify(profiles));
      fd.append("turn_count", String(turnCount));
      const res = await fetch("/api/household", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "failed");
      if (!data.parse) {
        setError("Didn't catch anything — try again?");
        setPhase("error");
        return;
      }
      const nextProfiles: Profile[] = data.parse.profiles;
      const nextIgnored: string[] = data.parse.acknowledged_but_ignored ?? [];
      const mergedIgnored = [...ignored, ...nextIgnored];
      setProfiles(nextProfiles);
      setIgnored(mergedIgnored);
      setFollowUp(data.parse.missing_field?.follow_up_question ?? null);
      setTurnCount(turnCount + 1);

      const needsFollowUp =
        !data.parse.give_up && data.parse.missing_field != null;
      if (needsFollowUp) {
        setPhase("ask");
      } else {
        onComplete(nextProfiles, mergedIgnored);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "household failed");
      setPhase("error");
    }
  };

  return (
    <div className="p-5 flex-1 overflow-y-auto">
      {phase === "ask" && profiles.length === 0 && (
        <>
          <Bubble>
            Tell me about your household — names, ages, and weight for the grown-ups.
          </Bubble>
          <VoiceRecorder onRecorded={handleRecording} prompt="Tap to dictate" />
        </>
      )}

      {phase === "ask" && profiles.length > 0 && followUp && (
        <>
          <Bubble>{followUp}</Bubble>
          <VoiceRecorder onRecorded={handleRecording} prompt="Tap and answer" />
        </>
      )}

      {phase === "parsing" && <Spinner label="Parsing…" />}

      {phase === "error" && (
        <>
          <p className="text-bad text-sm text-center my-4">{error}</p>
          <button className="btn-ghost" onClick={() => setPhase("ask")}>
            Try again
          </button>
        </>
      )}
    </div>
  );
}
