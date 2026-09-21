"use client";

import { useState } from "react";
import { Loader2 } from "@/components/ui/HeartfulIcon";

type DoseUnit = "mg" | "g" | "mL" | "other";

function splitDose(value: string): { amount: string; unit: DoseUnit } {
  if (!value.trim()) return { amount: "", unit: "mg" };
  const match = value.trim().match(/^(\d+(?:[.,]\d+)?)\s*(mg|g|ml)$/i);
  if (!match) return { amount: value, unit: "other" };
  return { amount: match[1].replace(",", "."), unit: match[2].toLowerCase() === "ml" ? "mL" : match[2].toLowerCase() as DoseUnit };
}

function joinDose(amount: string, unit: DoseUnit) {
  return amount.trim() ? unit === "other" ? amount.trim() : `${amount.trim()} ${unit}` : "";
}

/** Keeps the existing free-text stored value while offering common units explicitly. */
export default function DoseAmountField({ label, value, onChange, onSave, saving, saved, disabled = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  disabled?: boolean;
}) {
  const [{ amount: initialAmount, unit: initialUnit }] = useState(() => splitDose(value));
  const [amount, setAmount] = useState(initialAmount);
  const [unit, setUnit] = useState<DoseUnit>(initialUnit);

  return (
    <div className="journey-timing-dose">
      <label className="journey-timing-label" htmlFor={`journey-dose-${label.replace(/\s+/g, "-").toLowerCase()}`}>{label}</label>
      <div className="journey-timing-dose-inputs">
        <input
          id={`journey-dose-${label.replace(/\s+/g, "-").toLowerCase()}`}
          aria-label={`${label} amount`}
          type={unit === "other" ? "text" : "number"}
          inputMode={unit === "other" ? "text" : "decimal"}
          min={unit === "other" ? undefined : 0}
          step={unit === "other" ? undefined : "any"}
          value={amount}
          onChange={(event) => { setAmount(event.target.value); onChange(joinDose(event.target.value, unit)); }}
          disabled={disabled}
        />
        <select aria-label={`${label} unit`} value={unit} onChange={(event) => {
          const nextUnit = event.target.value as DoseUnit;
          const nextAmount = nextUnit === "other" || /^\d*(?:\.\d*)?$/.test(amount) ? amount : "";
          setUnit(nextUnit);
          setAmount(nextAmount);
          onChange(joinDose(nextAmount, nextUnit));
        }} disabled={disabled}>
          <option value="mg">mg</option>
          <option value="g">g</option>
          <option value="mL">mL</option>
          <option value="other">Other</option>
        </select>
      </div>
      <button className="journey-timing-save" disabled={disabled || saving} onClick={onSave}>
        {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
        {saving ? "Saving…" : "Save dose"}
      </button>
      {saved && <span className="journey-timing-saved" role="status">Saved</span>}
    </div>
  );
}
