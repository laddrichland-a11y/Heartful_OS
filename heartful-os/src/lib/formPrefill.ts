import { Client, Profile } from "@/lib/types";

// A map of form field id -> value to pre-populate. Applied by FormRenderer to
// empty short_text fields only, so it can never overwrite a saved answer or
// touch a signature/initial/consent field.
export type FormPrefill = Record<string, string>;

// The form library reuses a small set of canonical field ids for information
// we already hold on the client record and the practitioner profile - there is
// no reason to make either party retype them. Field ids here must match the
// ids in lib/mock/formTemplates.ts:
//
//   full_name, email             Participant Screening Form
//   client_name                  Harm Reduction + Client Services Agreements
//   client_name/email/phone,     Informed Consent
//   facilitator_name/email/phone
//
// Anything not listed is left blank for the client to fill in.
export function buildFormPrefill(
  client: Pick<Client, "full_name" | "email" | "phone">,
  practitioner?: Pick<Profile, "full_name" | "email" | "phone">
): FormPrefill {
  const prefill: FormPrefill = {};
  const set = (id: string, value?: string) => {
    const trimmed = value?.trim();
    if (trimmed) prefill[id] = trimmed;
  };

  // Client-side fields
  set("full_name", client.full_name);
  set("client_name", client.full_name);
  set("email", client.email);
  set("client_email", client.email);
  set("client_phone", client.phone);

  // Facilitator-side fields (Informed Consent)
  set("facilitator_name", practitioner?.full_name);
  set("facilitator_email", practitioner?.email);
  set("facilitator_phone", practitioner?.phone);

  return prefill;
}
