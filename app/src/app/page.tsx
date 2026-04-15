"use client";
import { useState } from "react";
import { ReceiptStep } from "@/components/ReceiptStep";
import { PantryStep } from "@/components/PantryStep";
import { HouseholdStep } from "@/components/HouseholdStep";
import { TargetsStep } from "@/components/TargetsStep";
import { ReadoutScreen } from "@/components/ReadoutScreen";
import { Spinner } from "@/components/Spinner";
import { ProgressBar } from "@/components/ProgressBar";
import type {
  NutritionItem,
  PantryItem,
  Profile,
  ReadoutOutput,
} from "@/lib/types";

type Step = "receipt" | "pantry" | "household" | "targets" | "loading" | "readout";

export default function Home() {
  const [step, setStep] = useState<Step>("receipt");
  const [store, setStore] = useState("");
  const [days, setDays] = useState(5);
  const [receiptItems, setReceiptItems] = useState<NutritionItem[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [acknowledgedIgnored, setAcknowledgedIgnored] = useState<string[]>([]);
  const [readout, setReadout] = useState<ReadoutOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startReadout = async (confirmedProfiles: Profile[]) => {
    // Commit the edited profiles back to page state so the ReadoutScreen's
    // collapsed per-person targets section renders the same numbers the
    // server just computed against.
    setProfiles(confirmedProfiles);
    setStep("loading");
    setError(null);
    try {
      const res = await fetch("/api/readout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store,
          days,
          receiptItems,
          pantryItems,
          profiles: confirmedProfiles,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "readout failed");
      setReadout(data.readout);
      setStep("readout");
    } catch (e) {
      setError(e instanceof Error ? e.message : "readout failed");
      setStep("targets");
    }
  };

  const reset = () => {
    setStep("receipt");
    setStore("");
    setDays(5);
    setReceiptItems([]);
    setPantryItems([]);
    setProfiles([]);
    setAcknowledgedIgnored([]);
    setReadout(null);
    setError(null);
  };

  const progressCurrent =
    step === "receipt"
      ? 1
      : step === "pantry"
      ? 2
      : step === "household" || step === "targets"
      ? 3
      : 4;

  return (
    <>
      <ProgressBar current={progressCurrent} />

      {step === "receipt" && (
        <ReceiptStep
          onComplete={({ store, items, days }) => {
            setStore(store);
            setReceiptItems(items);
            setDays(days);
            setStep("pantry");
          }}
        />
      )}
      {step === "pantry" && (
        <PantryStep
          onComplete={(items) => {
            setPantryItems(items);
            setStep("household");
          }}
        />
      )}
      {step === "household" && (
        <HouseholdStep
          onComplete={(ps, ignored) => {
            setProfiles(ps);
            setAcknowledgedIgnored(ignored);
            setStep("targets");
          }}
        />
      )}
      {step === "targets" && (
        <>
          {error && <div className="px-5 pt-3 text-xs text-bad">{error}</div>}
          <TargetsStep
            profiles={profiles}
            acknowledgedIgnored={acknowledgedIgnored}
            onComplete={startReadout}
          />
        </>
      )}
      {step === "loading" && <Spinner label="Writing your readout…" />}
      {step === "readout" && readout && (
        <ReadoutScreen
          readout={readout}
          receiptItems={receiptItems}
          pantryItems={pantryItems}
          profiles={profiles}
          days={days}
          store={store}
          onRestart={reset}
        />
      )}
    </>
  );
}
