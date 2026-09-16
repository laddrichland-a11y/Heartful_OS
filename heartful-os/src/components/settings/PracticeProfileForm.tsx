"use client";

import { useState, useTransition, type FormEvent } from "react";
import { updatePractitionerAction } from "@/lib/actions";

type ProfileFields = {
  full_name?: string;
  practice_name?: string;
  email?: string;
  phone?: string;
};

export default function PracticeProfileForm({ profile }: { profile: ProfileFields }) {
  const [values, setValues] = useState({
    full_name: profile.full_name ?? "",
    practice_name: profile.practice_name ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
  });
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function change(key: keyof typeof values, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setMessage("");
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      try {
        await updatePractitionerAction({
          full_name: values.full_name.trim(),
          practice_name: values.practice_name.trim(),
          email: values.email.trim(),
          phone: values.phone.trim(),
        });
        setMessage("Changes saved");
      } catch {
        setMessage("Could not save changes. Try again.");
      }
    });
  }

  return (
    <form onSubmit={save} className="settings-profile-form">
      <div className="settings-fields">
        {([
          ["full_name", "Practitioner name", "text", "Ladd Richland"],
          ["practice_name", "Practice name", "text", "Heartful Labs"],
          ["email", "Email", "email", "you@example.com"],
          ["phone", "Phone", "tel", "(555) 555-0100"],
        ] as const).map(([key, label, type, placeholder]) => (
          <label className="settings-field" key={key}>
            <span>{label}</span>
            <input
              type={type}
              value={values[key]}
              onChange={(event) => change(key, event.target.value)}
              placeholder={placeholder}
            />
          </label>
        ))}
      </div>
      <div className="settings-form-actions">
        <span role="status" className={message.startsWith("Could") ? "settings-error" : ""}>{message}</span>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
