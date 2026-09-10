"use client";

import { useState, useTransition, type ReactNode } from "react";
import { updatePractitionerAction } from "@/lib/actions";
import { Check, Mail, Phone, User, Building2 } from "lucide-react";

type ProfileFields = {
  full_name?: string;
  practice_name?: string;
  email?: string;
  phone?: string;
};

// Editable practice profile. These values feed the facilitator half of the
// Informed Consent form (see lib/formPrefill.ts) and sign client-facing
// emails. Before this existed the profile was display-only and could only be
// changed by editing the seed file — which is why facilitator phone had no
// value to autofill from: the field was never captured anywhere.
export default function PracticeProfileForm({ profile }: { profile: ProfileFields }) {
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [practiceName, setPracticeName] = useState(profile.practice_name ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(false);
    startTransition(async () => {
      await updatePractitionerAction({
        full_name: fullName.trim(),
        practice_name: practiceName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      setSaved(true);
    });
  }

  function field(
    label: string,
    icon: ReactNode,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    type = "text"
  ) {
    return (
      <div>
        <label className="text-xs font-medium text-ink-500 flex items-center gap-1.5">
          {icon} {label}
        </label>
        <input
          type={type}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setSaved(false);
          }}
          placeholder={placeholder}
          className="mt-1 w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {field("Practitioner name", <User className="h-3.5 w-3.5" />, fullName, setFullName, "Ladd Richland")}
      {field("Practice name", <Building2 className="h-3.5 w-3.5" />, practiceName, setPracticeName, "Heartful Labs")}
      {field("Email", <Mail className="h-3.5 w-3.5" />, email, setEmail, "you@example.com", "email")}
      {field("Phone", <Phone className="h-3.5 w-3.5" />, phone, setPhone, "(555) 555-0100", "tel")}
      <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-xs text-ink-400">
          Autofills the facilitator details on the Informed Consent form.
        </p>
        <button onClick={save} disabled={pending} className="btn-secondary text-xs px-3 py-2 shrink-0">
          {pending ? "Saving..." : saved ? <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Saved</span> : "Save"}
        </button>
      </div>
    </div>
  );
}
