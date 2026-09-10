// Plain-text templates for client-facing SMS. Heartful OS has no outbound
// SMS/email server wired up yet (no Twilio/etc. credentials — a dedicated
// email + SMS server is a planned future addition), so these are composed
// here and handed off to the practitioner's own phone via an sms: link, or
// copied to the clipboard. No text is ever sent automatically.

export function buildJourneySummaryReadyText(input: {
  clientFirstName: string;
  portalUrl: string;
  practitionerName?: string;
}): string {
  const { clientFirstName, portalUrl, practitionerName } = input;

  return `Hi ${clientFirstName}, your summary from our recent appointment is ready to view in your client portal: ${portalUrl}${
    practitionerName ? `\n\n— ${practitionerName}` : ""
  }`;
}
