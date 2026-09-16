"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { updatePractitionerAction } from "@/lib/actions";
import type { PaymentMethod, PaymentMethodKind } from "@/lib/types";

const METHOD_LABELS: Record<PaymentMethodKind, string> = {
  venmo: "Venmo", paypal: "PayPal", cash_app: "Cash App", zelle: "Zelle", bank_transfer: "Bank transfer", other: "Other",
};

function initialMethods(methods?: PaymentMethod[], venmoHandle?: string): PaymentMethod[] {
  if (methods?.length) return methods;
  return venmoHandle ? [{ id: "venmo", kind: "venmo", label: "Venmo", details: venmoHandle }] : [];
}

export default function VenmoSettingsForm({ venmoHandle, paymentMethods }: { venmoHandle?: string; paymentMethods?: PaymentMethod[] }) {
  const [methods, setMethods] = useState(() => initialMethods(paymentMethods, venmoHandle));
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function updateMethod(id: string, patch: Partial<PaymentMethod>) {
    setMethods((current) => current.map((method) => method.id === id ? { ...method, ...patch } : method));
    setMessage("");
  }

  function addMethod() {
    setMethods((current) => [...current, { id: `method-${Date.now()}`, kind: "paypal", label: "PayPal", details: "" }]);
  }

  function save() {
    const complete = methods.filter((method) => method.details.trim()).map((method) => ({ ...method, label: method.label.trim() || METHOD_LABELS[method.kind], details: method.details.trim() }));
    startTransition(async () => {
      try {
        await updatePractitionerAction({
          payment_methods: complete,
          venmo_handle: complete.find((method) => method.kind === "venmo")?.details.replace(/^@/, "") ?? "",
        });
        setMethods(complete);
        setMessage("Payment methods saved");
      } catch {
        setMessage("Could not save. Try again.");
      }
    });
  }

  return (
    <div className="settings-payment-methods">
      <p className="settings-payment-intro">Add payment links or instructions that you share with clients.</p>
      {methods.length === 0 ? <p className="settings-payment-empty">No payment methods connected yet.</p> : (
        <div className="settings-payment-method-list">
          {methods.map((method) => (
            <div className="settings-payment-method" key={method.id}>
              <select value={method.kind} aria-label="Payment method" onChange={(event) => updateMethod(method.id, { kind: event.target.value as PaymentMethodKind, label: METHOD_LABELS[event.target.value as PaymentMethodKind] })}>
                {Object.entries(METHOD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <input value={method.details} onChange={(event) => updateMethod(method.id, { details: event.target.value })} placeholder={method.kind === "bank_transfer" ? "Payment instructions" : "Username or payment link"} aria-label={`${method.label} payment details`} />
              <button type="button" className="settings-remove-payment" onClick={() => setMethods((current) => current.filter((item) => item.id !== method.id))} aria-label={`Remove ${method.label}`}><Trash2 aria-hidden="true" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="settings-payment-actions">
        <button type="button" className="settings-add-source" onClick={addMethod}><Plus aria-hidden="true" /> Add payment method</button>
        <button type="button" className="btn-primary" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save payment methods"}</button>
      </div>
      {message && <p className={message.startsWith("Could") ? "settings-error" : "settings-success"} role="status">{message}</p>}
    </div>
  );
}
