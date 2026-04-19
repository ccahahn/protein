"use client";
import { useState } from "react";
import { EntryStep } from "@/components/EntryStep";
import { ReadoutScreen } from "@/components/ReadoutScreen";
import { Spinner } from "@/components/Spinner";
import { ProgressBar } from "@/components/ProgressBar";
import type { NutritionItem, ReadoutOutput } from "@/lib/types";

type Step = "entry" | "loading" | "readout";

export default function Home() {
  const [step, setStep] = useState<Step>("entry");
  const [store, setStore] = useState("");
  const [receiptItems, setReceiptItems] = useState<NutritionItem[]>([]);
  const [readout, setReadout] = useState<ReadoutOutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startReadout = async (
    items: NutritionItem[],
    storeName: string,
    servings?: number
  ) => {
    setStore(storeName);
    setReceiptItems(items);
    setStep("loading");
    setError(null);
    try {
      const res = await fetch("/api/readout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store: storeName,
          receiptItems: items,
          servings,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "readout failed");
      setReadout(data.readout);
      setStep("readout");
    } catch (e) {
      setError(e instanceof Error ? e.message : "readout failed");
      setStep("entry");
    }
  };

  const reset = () => {
    setStep("entry");
    setStore("");
    setReceiptItems([]);
    setReadout(null);
    setError(null);
  };

  const progressCurrent = step === "entry" ? 1 : 2;

  return (
    <>
      <ProgressBar current={progressCurrent} total={2} />

      {step === "entry" && (
        <>
          {error && <div className="px-5 pt-3 text-xs text-bad">{error}</div>}
          <EntryStep
            onComplete={({ store, items, servings }) =>
              startReadout(items, store, servings)
            }
          />
        </>
      )}
      {step === "loading" && <Spinner label="Writing your readout…" />}
      {step === "readout" && readout && (
        <ReadoutScreen
          readout={readout}
          receiptItems={receiptItems}
          store={store}
          onRestart={reset}
        />
      )}
    </>
  );
}
