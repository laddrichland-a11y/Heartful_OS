import { getAiSummaries, getSessions, pickPhaseSession } from "@/lib/data";
import PrepareMeCard from "@/components/client/PrepareMeCard";
import { SessionType } from "@/lib/types";

/**
 * Server wrapper so each stage page can drop in Prepare Me with one line.
 *
 * Each stage gets its OWN briefing. Previously this loaded "the most recent
 * session-less briefing" for the client, with no notion of which stage it
 * belonged to — so a briefing generated on the Preparation page reappeared,
 * verbatim, on Check-In, Integration 1, Integration 2 and Growth Plan, while
 * Journey Day (reached through its session record) showed nothing at all.
 *
 * Scoping now works in two tiers:
 *   1. If the client has a session of this stage's type on the calendar, the
 *      briefing is filed against that session — which also means the stage
 *      page and that session's own detail page share one briefing instead of
 *      generating two unrelated ones.
 *   2. If there's no session yet (a brand-new client, or a stage like Growth
 *      Action Plan that has no session at all), it falls back to matching on
 *      `stage_label`.
 *
 * Either way the generated content is built from the client's whole record —
 * every prior session's notes and transcripts, all earlier summaries,
 * milestones, memory and forms (see the prepare_me_briefing case in
 * /api/ai/generate) — so later stages build on everything before them.
 */
export default async function PhasePrepareMe({
  clientId,
  sessionTypeLabel,
  sessionType,
  sessionId: sessionIdProp,
}: {
  clientId: string;
  sessionTypeLabel: string;
  /** Session type this stage maps to; omit for stages with no session (Growth Action Plan). */
  sessionType?: SessionType;
  /** Pass directly when the page has already resolved its session, to skip the extra lookup. */
  sessionId?: string;
}) {
  let sessionId = sessionIdProp;
  if (!sessionId && sessionType) {
    const sessions = await getSessions(clientId);
    sessionId = pickPhaseSession(sessions, sessionType)?.id;
  }

  const summaries = await getAiSummaries(clientId, "prepare_me_briefing");
  const existing = sessionId
    ? summaries.find((s) => s.session_id === sessionId)
    : summaries.find((s) => !s.session_id && s.stage_label === sessionTypeLabel);

  return (
    <PrepareMeCard
      clientId={clientId}
      sessionTypeLabel={sessionTypeLabel}
      sessionId={sessionId}
      existing={existing}
    />
  );
}
