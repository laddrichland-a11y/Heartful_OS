"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { useRole } from "@/components/RoleContext";
import { useRouter, useSearchParams } from "next/navigation";
import {
  listClientsForPortalAction,
  getPortalBundleAction,
  createPortalAccountAction,
  portalLoginAction,
  completeTaskAction,
  completePortalAssignmentAction,
  sendMessageAction,
  submitCheckInAction,
  saveFormProgressAction,
  submitClientFormAction,
  getFormSubmissionAction,
  getPortalRecordingUrlAction,
  markPortalWelcomeSeenAction,
  reportDeadPortalLinkAction,
} from "@/lib/actions";
import {
  AiSummary,
  Client,
  Task,
  PortalAssignment,
  Message,
  GrowthActionPlan,
  Profile,
  CheckIn,
  PostIntegrationForm,
  JourneyMilestone,
  ClientDocument,
  FormTemplate,
  FormSubmission,
  DOCUMENT_LABELS,
  JourneyPhase,
  Session,
  Recording,
} from "@/lib/types";
import { HeartHandshake, CheckCircle2, Circle, Send, FileSignature, Sparkles, FileText, ChevronDown, ChevronUp, CalendarDays, MapPin, Clock, Pencil, MessageSquareText, Music, ScrollText } from "lucide-react";
import { formatDate, formatDateTime, relativeDueLabel, cx, isGeneralPaperwork } from "@/lib/utils";
import JourneyProgressBar from "@/components/JourneyProgressBar";
import FormRenderer from "@/components/forms/FormRenderer";
import { buildFormPrefill, FormPrefill } from "@/lib/formPrefill";
import PortalWelcome from "@/components/portal/PortalWelcome";

export const dynamic = "force-dynamic";

// Chronological order of the journey, used to decide whether a client has
// reached the point where certain forms/check-ins are relevant.
const PHASE_ORDER: JourneyPhase[] = [
  "intake",
  "preparation",
  "harm_reduction_session",
  "post_journey_check_in",
  "integration_1",
  "integration_2",
  "closed",
];

// Maps document_type directly to the journey phase it belongs to. This is
// more reliable than reading session_types off the template record because
// Firestore templates seeded before session_types was added won't have that
// field. If a document_type is absent here, we show it unconditionally (safe
// default for consent docs, etc.).
const DOCUMENT_TYPE_TO_PHASE: Partial<Record<string, JourneyPhase>> = {
  integration_session_1: "integration_1",
  integration_session_2: "integration_2",
  post_integration_form: "integration_2",
  post_integration_form_updated: "integration_2",
  integration_summary_1: "integration_1",
  integration_summary_2: "integration_2",
};

interface Bundle {
  client?: Client;
  // Practitioner profile, used to prefill the facilitator fields on the
  // Informed Consent form.
  practitioner?: Profile;
  tasks: Task[];
  assignments: PortalAssignment[];
  messages: Message[];
  growthPlan?: GrowthActionPlan;
  checkIns: CheckIn[];
  postIntegrationForms: PostIntegrationForm[];
  milestones: JourneyMilestone[];
  documents: ClientDocument[];
  formTemplates: FormTemplate[];
  formSubmissions: FormSubmission[];
  sessions: Session[];
  sessionCallSummaries: AiSummary[];
  recordings: Recording[];
}

const TABS = ["Home", "Appointments", "Forms & Check-Ins", "Growth & Integration", "Messages"] as const;

export default function PortalPage() {
  return (
    <Suspense fallback={null}>
      <PortalPageInner />
    </Suspense>
  );
}

function PortalPageInner() {
  const { role, setRole, portalClientId, setPortalClientId, isPreview, setIsPreview, hydrated } = useRole();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Read the value out ONCE, as a primitive. `searchParams` is memoized on the
  // router's context value, which changes identity on every router update —
  // and a server-action response counts as one. An effect that both depends on
  // the object and calls a server action therefore refires its own trigger:
  // fetch -> setState -> router update -> new object -> fetch. That loop is
  // what made the portal blink instead of load (341 refetches in 5 seconds).
  const clientFromQuery = searchParams.get("client");
  const [clients, setClients] = useState<{ id: string; full_name: string }[]>([]);
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [authGate, setAuthGate] = useState<{ accountExists: boolean; clientEmail?: string } | null>(null);
  // Set once ?client=<id> is confirmed dead. Holds who to contact, and
  // whether the viewer is the practitioner (who needs a way out, not a
  // "contact your practitioner" message).
  const [linkInvalid, setLinkInvalid] = useState<{
    isPractitioner: boolean;
    practitionerName?: string;
    practitionerEmail?: string;
  } | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Home");
  // Practitioner-preview escape hatch for the agreements gate below. Real
  // clients never get this — for them the gate is the whole portal until
  // the paperwork is signed.
  const [previewSkipGate, setPreviewSkipGate] = useState(false);
  // Welcome page: null = follow the client record, true/false = this session's
  // override (dismissed just now, or re-opened via the header link).
  const [welcomeOverride, setWelcomeOverride] = useState<boolean | null>(null);
  const [, startTransition] = useTransition();

  // Intro emails link straight to a specific client's portal via
  // /portal?client=<id>. That link is the only "auth" a client has, so it
  // must win over whatever role/client was previously active on this
  // device/browser — otherwise a fresh browser session (role defaults to
  // "practitioner") bounces straight back to /dashboard before this effect
  // ever gets a chance to flip into client mode.
  useEffect(() => {
    const fromQuery = clientFromQuery;
    if (fromQuery) {
      if (role !== "client") setRole("client");
      if (fromQuery !== portalClientId) setPortalClientId(fromQuery);
      if (isPreview) setIsPreview(false);
      return;
    }
    // Wait for RoleContext to finish reading localStorage. Until it does,
    // `role` is the "practitioner" placeholder for every visitor — so
    // redirecting here unconditionally sent real clients to /dashboard, where
    // AppShell's mirror-image guard sent them straight back. The middleware
    // redirect in between forced a full document load each pass, remounting
    // RoleProvider and resetting `role`, so the two never converged. That was
    // the blink/loop.
    if (!hydrated) return;
    if (role !== "client") router.replace("/dashboard");
  }, [hydrated, clientFromQuery, role, portalClientId, isPreview, setRole, setPortalClientId, setIsPreview, router]);

  useEffect(() => {
    if (hydrated && !portalClientId) {
      listClientsForPortalAction().then(setClients);
    }
  }, [hydrated, portalClientId]);

  useEffect(() => {
    if (portalClientId) {
      getPortalBundleAction(portalClientId).then((b) => {
        if ("locked" in b && b.locked) {
          setAuthGate({ accountExists: b.accountExists, clientEmail: b.clientEmail });
          return;
        }
        const next = b as Bundle;
        if (!next.client) {
          // The in-memory mock store resets on every dev-server restart, so a
          // client id cached in localStorage from a previous run can point at
          // nothing. Without this, the page just sits on "Loading your
          // portal..." forever.
          //
          // A client who arrived via ?client=<id> gets a dead end rather than
          // the picker below: that picker lists every client's name, and now
          // that middleware can rebuild the deep link from a cookie, a stale
          // id would otherwise put a real client in front of that list.
          if (clientFromQuery) {
            // Also clears the remembered-client cookie server-side, so
            // middleware stops rebuilding this dead link on every visit.
            reportDeadPortalLinkAction().then(setLinkInvalid);
            return;
          }
          setPortalClientId("");
          return;
        }
        setAuthGate(null);
        setBundle(next);
      });
    }
  }, [portalClientId, setPortalClientId, clientFromQuery]);

  // Nothing role-dependent can be rendered before hydration either — the
  // demo picker below keys off portalClientId, which is "" until then, so a
  // returning client would flash the practitioner-only client list.
  if (!hydrated) {
    return <div className="min-h-screen flex items-center justify-center text-ink-400 text-sm">Loading your portal...</div>;
  }

  if (linkInvalid) {
    const { isPractitioner, practitionerName, practitionerEmail } = linkInvalid;
    const practitionerFirstName = practitionerName?.split(" ")[0];
    const mailtoHref = practitionerEmail
      ? `mailto:${practitionerEmail}?subject=${encodeURIComponent("I need a new portal link")}&body=${encodeURIComponent(
          "Hi — the link to my client portal isn't working. Could you send me a fresh one?\n\nThank you!"
        )}`
      : null;
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          <div className="h-10 w-10 rounded-lg bg-clay-500 text-white flex items-center justify-center mx-auto">
            <HeartHandshake className="h-5 w-5" />
          </div>
          {isPractitioner ? (
            <>
              <h1 className="text-lg font-semibold text-ink-900">That client link is out of date</h1>
              <p className="text-sm text-ink-500">
                {`The id in this URL doesn't match any client record — the client was probably deleted, or the link came from an older environment.`}
              </p>
              <div className="flex gap-2 justify-center pt-1">
                <button
                  onClick={() => {
                    setLinkInvalid(null);
                    setPortalClientId("");
                    router.replace("/portal");
                  }}
                  className="btn-secondary text-sm px-4 py-2"
                >
                  Pick a client
                </button>
                <button
                  onClick={() => {
                    setLinkInvalid(null);
                    setRole("practitioner");
                    router.replace("/dashboard");
                  }}
                  className="btn-primary text-sm px-4 py-2"
                >
                  Back to dashboard
                </button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-lg font-semibold text-ink-900">This portal link isn&apos;t working</h1>
              <p className="text-sm text-ink-500">
                {practitionerFirstName
                  ? `${practitionerFirstName} can send you a fresh one — it only takes a moment.`
                  : "Your practitioner can send you a fresh one — it only takes a moment."}
              </p>
              {mailtoHref && (
                <a href={mailtoHref} className="btn-primary text-sm px-4 py-2 inline-block">
                  {practitionerFirstName ? `Email ${practitionerFirstName}` : "Email your practitioner"}
                </a>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  if (!portalClientId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          <div className="h-10 w-10 rounded-lg bg-clay-500 text-white flex items-center justify-center mx-auto">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-ink-900">Welcome to your Client Portal</h1>
          <p className="text-sm text-ink-500">For this demo, choose which client account to view.</p>
          <div className="space-y-2 text-left">
            {clients.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setIsPreview(true);
                  setPortalClientId(c.id);
                }}
                className="w-full text-left px-4 py-2.5 rounded-xl border border-ink-200 hover:border-clay-400 hover:bg-clay-50 text-sm font-medium text-ink-800 transition-colors"
              >
                {c.full_name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (authGate) {
    return (
      <PortalAuthGate
        clientId={portalClientId}
        accountExists={authGate.accountExists}
        clientEmail={authGate.clientEmail}
        onUnlocked={() => {
          getPortalBundleAction(portalClientId).then((b) => {
            if (!("locked" in b && b.locked)) {
              setAuthGate(null);
              setBundle(b as Bundle);
            }
          });
        }}
      />
    );
  }

  if (!bundle || !bundle.client) {
    return <div className="min-h-screen flex items-center justify-center text-ink-400 text-sm">Loading your portal...</div>;
  }

  const { client } = bundle;
  // Name/email/phone we already hold, used to prefill matching fields on
  // every form the client opens instead of asking them to retype it.
  const prefill = buildFormPrefill(client, bundle.practitioner);
  const pendingTasks = bundle.tasks.filter((t) => t.status !== "completed");
  const pendingAssignments = bundle.assignments.filter((a) => a.status !== "completed");
  // Forms/consents are tracked separately from Task records (they're
  // auto-attached documents, not tasks), so the Action Items list has to
  // pull them in explicitly — otherwise a client with zero tasks but
  // unsubmitted forms incorrectly sees "all caught up".
  const clientPhaseIdx = PHASE_ORDER.indexOf(client.current_phase);
  const incompleteForms = bundle.documents
    .map((doc) => {
      const template = bundle.formTemplates.find((t) => t.document_type === doc.document_type);
      if (!template) return null;
      const submission = bundle.formSubmissions.find((s) => s.document_id === doc.id);
      const status = submission?.status ?? "missing";
      if (status === "submitted" || status === "signed") return null;
      // Gate forms to their journey phase using document_type. This works
      // even when Firestore templates lack session_types. If no phase entry
      // exists for this document_type (e.g. consent forms), show it always.
      const requiredPhase = DOCUMENT_TYPE_TO_PHASE[doc.document_type];
      if (requiredPhase && PHASE_ORDER.indexOf(requiredPhase) > clientPhaseIdx) return null;
      return { doc, template, status };
    })
    .filter((x): x is { doc: ClientDocument; template: FormTemplate; status: string } => x !== null);
  const hasActionItems = pendingTasks.length > 0 || pendingAssignments.length > 0 || incompleteForms.length > 0;
  const refresh = () => getPortalBundleAction(portalClientId).then((b) => setBundle(b as Bundle));

  const sessionCallSummaries = bundle.sessionCallSummaries ?? [];
  const recordings = bundle.recordings ?? [];

  // -------------------------------------------------------------------------
  // ONBOARDING GATE — the practice-wide agreements come before anything else.
  //
  // These three are the paperwork a client signs once, on joining. Until
  // they're done the portal shows nothing but them: no tabs, no journey, no
  // messages. Signing all three drops the gate permanently.
  // -------------------------------------------------------------------------
  const agreementItems = bundle.documents
    .filter((doc) => isGeneralPaperwork(doc.document_type))
    .map((doc) => {
      const template = bundle.formTemplates.find((t) => t.document_type === doc.document_type);
      if (!template) return null;
      const submission = bundle.formSubmissions.find((sub) => sub.document_id === doc.id);
      const status = submission?.status ?? "missing";
      return { doc, template, submission, done: status === "signed" || status === "submitted" };
    })
    .filter((x) => x !== null);
  const agreementsDone = agreementItems.filter((a) => a.done).length;
  const agreementsOutstanding = agreementItems.length - agreementsDone;

  if (agreementItems.length > 0 && agreementsOutstanding > 0 && !previewSkipGate) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <header className="bg-white border-b border-ink-100">
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-3.5 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-clay-500 text-white flex items-center justify-center">
              <HeartHandshake className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="font-semibold text-ink-900 leading-tight">Heartful OS</div>
              <div className="text-[11px] text-ink-400 leading-tight">Your Journey Portal</div>
            </div>
            {isPreview && (
              <button
                onClick={() => setPreviewSkipGate(true)}
                className="ml-auto text-xs text-clay-600 hover:text-clay-700 underline underline-offset-2"
              >
                Skip (preview only)
              </button>
            )}
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-5">
          <div className="text-center space-y-2">
            <div className="h-11 w-11 rounded-full bg-clay-100 text-clay-600 flex items-center justify-center mx-auto">
              <FileSignature className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold text-ink-900">
              Welcome, {client.full_name.split(" ")[0]}
            </h1>
            <p className="text-sm text-ink-500 leading-relaxed">
              {/* One template string, not JSX text: the build strips the leading
                  space from a text node that follows an expression container,
                  which rendered this as "short formsto read through". */}
              {`Before we begin, there ${
                agreementItems.length === 1 ? "is one form" : `are ${agreementItems.length} short forms`
              } to read through and sign. They cover consent, what this work involves, and how we’ll work together. Take your time with them — your portal opens up once they’re signed.`}
            </p>
          </div>

          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-ink-900 text-sm">Your agreements</h2>
              <span className="text-xs text-ink-400">
                {agreementsDone} of {agreementItems.length} signed
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
              <div
                className="h-full bg-clay-500 transition-all"
                style={{ width: `${(agreementsDone / agreementItems.length) * 100}%` }}
              />
            </div>
            <div className="space-y-2">
              {agreementItems.map(({ doc, template, submission }) => (
                <FormDocumentCard
                  key={doc.id}
                  clientId={portalClientId}
                  document={doc}
                  template={template}
                  submission={submission}
                  packageValue={client.package_value}
                  prefill={prefill}
                  onChanged={refresh}
                />
              ))}
            </div>
          </div>

          <p className="text-xs text-ink-400 text-center">
            {`Questions about any of this? Reach out to ${
              bundle.practitioner?.full_name ?? "your practitioner"
            } before signing — there’s no rush.`}
          </p>
        </main>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // WELCOME — the first thing they see once the agreements are behind them.
  // Shown once (portal_welcome_seen_at is unset), then reachable on demand
  // from the header link. Preview mode never auto-shows it, so the
  // practitioner isn't stopped by it every time they look at a client.
  // -------------------------------------------------------------------------
  const welcomeUnseen = !client.portal_welcome_seen_at && !isPreview;
  const showWelcome = welcomeOverride ?? welcomeUnseen;

  if (showWelcome) {
    return (
      <div className="min-h-screen bg-[var(--background)]">
        <header className="bg-white border-b border-ink-100">
          <div className="max-w-2xl mx-auto px-4 md:px-6 py-3.5 flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-clay-500 text-white flex items-center justify-center">
              <HeartHandshake className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="font-semibold text-ink-900 leading-tight">Heartful OS</div>
              <div className="text-[11px] text-ink-400 leading-tight">Your Journey Portal</div>
            </div>
          </div>
        </header>
        <main className="px-4 md:px-6 py-8">
          <PortalWelcome
            clientFirstName={client.full_name.split(" ")[0]}
            practitioner={bundle.practitioner}
            dismissLabel={client.portal_welcome_seen_at ? "Back to my portal" : "Take me to my portal"}
            onDismiss={async () => {
              // Only the first dismissal writes the flag; re-opening it later
              // from the header link is just a local toggle.
              if (!client.portal_welcome_seen_at) {
                await markPortalWelcomeSeenAction(portalClientId);
                await refresh();
              }
              setWelcomeOverride(false);
            }}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-ink-100">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between">
          <button
            onClick={() => setTab("Home")}
            className="flex items-center gap-2 rounded-lg -ml-1 px-1 hover:bg-ink-50 transition-colors"
            title="Go to your home"
          >
            <div className="h-8 w-8 rounded-lg bg-clay-500 text-white flex items-center justify-center">
              <HeartHandshake className="h-4.5 w-4.5" />
            </div>
            <div className="text-left">
              <div className="font-semibold text-ink-900 leading-tight">Heartful OS</div>
              <div className="text-[11px] text-ink-400 leading-tight">Your Journey Portal</div>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setWelcomeOverride(true)}
              className="text-xs text-ink-400 hover:text-clay-600 underline underline-offset-2 hidden sm:inline"
            >
              About this portal
            </button>
            <div className="text-sm text-ink-600">Hi, {client.full_name.split(" ")[0]}</div>
            {isPreview && (
              <>
                <button
                  onClick={() => {
                    setBundle(null);
                    setPortalClientId("");
                  }}
                  className="text-xs text-clay-600 hover:text-clay-700 underline underline-offset-2"
                >
                  Switch client
                </button>
                <div className="flex items-center text-xs bg-ink-50 rounded-full p-1">
                  <button
                    onClick={() => setRole("practitioner")}
                    className="px-3 py-1 rounded-full transition-colors text-ink-500 hover:text-ink-800"
                  >
                    Practitioner View
                  </button>
                  <span className="px-3 py-1 rounded-full bg-white shadow text-ink-900 font-medium">Client Portal View</span>
                </div>
              </>
            )}
          </div>
        </div>
        <nav className="max-w-4xl mx-auto px-4 md:px-6 flex gap-4 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cx(
                "text-sm pb-2.5 border-b-2 whitespace-nowrap transition-colors",
                tab === t ? "border-clay-500 text-clay-700 font-medium" : "border-transparent text-ink-500 hover:text-ink-800"
              )}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {tab === "Home" && (
          <div className="space-y-6">
            <div className="card p-5">
              <h2 className="font-semibold text-ink-900 mb-3">Your Journey</h2>
              <JourneyProgressBar milestones={bundle.milestones} />
            </div>
            {/* Every appointment — upcoming and past, every session type
                (intake, prep, Journey Day, check-in, integration) — not
                just ones that happen to have a generated summary yet.
                Same panel as the Appointments tab, surfaced here too so
                the client sees it without switching tabs. */}
            <AppointmentsPanel
              clientId={portalClientId}
              sessions={bundle.sessions}
              sessionCallSummaries={sessionCallSummaries}
              recordings={recordings}
              formTemplates={bundle.formTemplates}
              documents={bundle.documents}
              formSubmissions={bundle.formSubmissions}
              packageValue={client.package_value}
              prefill={prefill}
            />
            <div className="card p-5">
              <h2 className="font-semibold text-ink-900 mb-3">Action Items</h2>
              {!hasActionItems ? (
                <p className="text-sm text-ink-400">You&apos;re all caught up — nothing pending right now.</p>
              ) : (
                <ul className="space-y-2">
                  {pendingTasks.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startTransition(async () => {
                            await completeTaskAction(t.id, portalClientId);
                            refresh();
                          })}
                        >
                          <Circle className="h-4 w-4 text-ink-300 hover:text-sage-500" />
                        </button>
                        <span className="text-ink-800">{t.title}</span>
                      </div>
                      <span className="text-xs text-ink-400">{relativeDueLabel(t.due_at)}</span>
                    </li>
                  ))}
                  {pendingAssignments.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                      <button
                        onClick={() => setTab("Forms & Check-Ins")}
                        className="flex items-center gap-2 text-left"
                      >
                        <Circle className="h-4 w-4 text-ink-300" />
                        <span className="text-ink-800">{a.title}</span>
                      </button>
                      <span className="text-xs text-ink-400">{relativeDueLabel(a.due_at)}</span>
                    </li>
                  ))}
                  {incompleteForms.map(({ doc, template, status }) => (
                    <li key={doc.id} className="flex items-center justify-between gap-3 text-sm">
                      <button
                        onClick={() => setTab("Forms & Check-Ins")}
                        className="flex items-center gap-2 text-left"
                      >
                        <Circle className="h-4 w-4 text-ink-300" />
                        <span className="text-ink-800">
                          {DOCUMENT_LABELS[doc.document_type] ?? template.title}
                        </span>
                      </button>
                      <span className="text-xs text-ink-400">
                        {(status === "in_progress" || status === "draft") ? "In progress" : "Not started"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === "Appointments" && (
          <AppointmentsPanel
            clientId={portalClientId}
            sessions={bundle.sessions}
            sessionCallSummaries={bundle.sessionCallSummaries ?? []}
            recordings={bundle.recordings ?? []}
            formTemplates={bundle.formTemplates}
            documents={bundle.documents}
            formSubmissions={bundle.formSubmissions}
            packageValue={client.package_value}
              prefill={prefill}
          />
        )}

        {tab === "Forms & Check-Ins" && (
          <div className="space-y-6">
            <div className="card p-5">
              <h2 className="font-semibold text-ink-900 mb-3">Required Forms &amp; Consents</h2>
              {bundle.documents.filter((d) => bundle.formTemplates.some((t) => t.document_type === d.document_type)).length === 0 ? (
                <p className="text-sm text-ink-400">Nothing to fill out right now.</p>
              ) : (
                <div className="space-y-2">
                  {bundle.documents
                    .filter((d) => bundle.formTemplates.some((t) => t.document_type === d.document_type))
                    .map((doc) => {
                      const template = bundle.formTemplates.find((t) => t.document_type === doc.document_type);
                      const submission = bundle.formSubmissions.find((s) => s.document_id === doc.id);
                      if (!template) return null;
                      return (
                        <FormDocumentCard
                          key={doc.id}
                          clientId={portalClientId}
                          document={doc}
                          template={template}
                          submission={submission}
                          packageValue={client.package_value}
              prefill={prefill}
                          onChanged={refresh}
                        />
                      );
                    })}
                </div>
              )}
            </div>
            <div className="card p-5">
              <h2 className="font-semibold text-ink-900 mb-3">Assigned Forms &amp; Homework</h2>
              {pendingAssignments.length === 0 ? (
                <p className="text-sm text-ink-400">No assignments waiting on you.</p>
              ) : (
                <ul className="space-y-2">
                  {pendingAssignments.map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 text-sm border-b border-ink-100 pb-2 last:border-0">
                      <div>
                        <div className="font-medium text-ink-800">{a.title}</div>
                        {a.description && <div className="text-xs text-ink-500 mt-0.5">{a.description}</div>}
                        <span className="badge mt-1 inline-block capitalize bg-ink-100 text-ink-600">
                          {a.assignment_type.replace(/_/g, " ")}
                        </span>
                      </div>
                      <button
                        onClick={() => startTransition(async () => {
                          await completePortalAssignmentAction(a.id, portalClientId);
                          refresh();
                        })}
                        className="btn-secondary text-xs px-3 py-1.5 shrink-0"
                      >
                        Mark Done
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {(bundle.checkIns.length > 0 || PHASE_ORDER.indexOf(client.current_phase) >= PHASE_ORDER.indexOf("post_journey_check_in")) && (
              <CheckInCard clientId={portalClientId} checkIn={bundle.checkIns[0]} onSaved={refresh} />
            )}
          </div>
        )}

        {tab === "Growth & Integration" && (
          <div className="space-y-6">
            <div className="card p-5">
              <h2 className="font-semibold text-ink-900 mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-clay-500" /> Your Growth Action Plan
              </h2>
              {bundle.growthPlan ? (
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <PlanList title="30-Day Commitments" items={bundle.growthPlan.thirty_day_commitments} />
                  <PlanList title="Behavioral Experiments" items={bundle.growthPlan.behavioral_experiments} />
                  <PlanList title="Daily Practices" items={bundle.growthPlan.daily_practices} />
                  <PlanList title="Reflection Questions" items={bundle.growthPlan.reflection_questions} />
                  <PlanList title="Accountability Commitments" items={bundle.growthPlan.accountability_commitments} />
                </div>
              ) : (
                <p className="text-sm text-ink-400">Your Growth Action Plan will appear here after Integration Session Two.</p>
              )}
            </div>
          </div>
        )}

        {tab === "Messages" && <MessagesPanel clientId={portalClientId} messages={bundle.messages} onSent={refresh} />}
      </main>
    </div>
  );
}

const SESSION_STATUS_BADGE: Record<Session["status"], string> = {
  scheduled: "bg-sage-100 text-sage-700",
  completed: "bg-ink-100 text-ink-600",
  cancelled: "bg-ink-100 text-ink-400",
  no_show: "bg-clay-100 text-clay-700",
};

// Friendlier, client-facing names for each session type — "Journey Day"
// reads a lot better to a client than the internal "Harm Reduction Support"
// session_type value.
const SESSION_TYPE_DISPLAY_LABELS: Partial<Record<Session["session_type"], string>> = {
  intake_assessment: "Intake & Assessment",
  preparation: "Preparation Session",
  harm_reduction_support: "Journey Day",
  check_in_12hr: "12-Hour Check-In",
  integration_1: "Integration Session One",
  integration_2: "Integration Session Two",
};

function sessionTypeLabel(type: Session["session_type"]) {
  return SESSION_TYPE_DISPLAY_LABELS[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function AppointmentsPanel({
  clientId,
  sessions,
  sessionCallSummaries,
  recordings,
  formTemplates,
  documents,
  formSubmissions,
  packageValue,
  prefill,
}: {
  clientId: string;
  sessions: Session[];
  sessionCallSummaries: AiSummary[];
  recordings: Recording[];
  formTemplates: FormTemplate[];
  documents: ClientDocument[];
  formSubmissions: FormSubmission[];
  packageValue?: number;
  prefill?: FormPrefill;
}) {
  // Mirrors the "scheduled" vs everything-else split already used in
  // lib/data.ts's getUpcomingSessions — avoids comparing against Date.now()
  // during render (an impure call React's purity rules flag).
  const upcoming = sessions
    .filter((s) => s.status === "scheduled" && s.scheduled_at)
    .sort((a, b) => (a.scheduled_at! < b.scheduled_at! ? -1 : 1));
  const past = sessions
    .filter((s) => s.status !== "scheduled" || !s.scheduled_at)
    .sort((a, b) => ((b.scheduled_at ?? "") < (a.scheduled_at ?? "") ? -1 : 1));

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-clay-500" /> Upcoming Appointments
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-ink-400">No upcoming appointments scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((s) => (
              <SessionRow key={s.id} clientId={clientId} session={s} callSummaries={[]} recordings={[]} />
            ))}
          </ul>
        )}
      </div>
      <div className="card p-5">
        <h2 className="font-semibold text-ink-900 mb-3">Past Appointments</h2>
        {past.length === 0 ? (
          <p className="text-sm text-ink-400">No past appointments yet.</p>
        ) : (
          <ul className="space-y-3">
            {past.map((s) => (
              <SessionRow
                key={s.id}
                clientId={clientId}
                session={s}
                callSummaries={sessionCallSummaries.filter((cs) => cs.session_id === s.id)}
                recordings={recordings.filter((r) => r.session_id === s.id)}
                formTemplates={formTemplates}
                documents={documents}
                formSubmissions={formSubmissions}
                packageValue={packageValue}
                      prefill={prefill}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SessionRow({
  clientId,
  session: s,
  callSummaries,
  recordings,
  formTemplates = [],
  documents = [],
  formSubmissions = [],
  packageValue,
  prefill,
}: {
  clientId: string;
  session: Session;
  callSummaries: AiSummary[];
  recordings: Recording[];
  formTemplates?: FormTemplate[];
  documents?: ClientDocument[];
  formSubmissions?: FormSubmission[];
  packageValue?: number;
  prefill?: FormPrefill;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [openFormDocId, setOpenFormDocId] = useState<string | null>(null);

  // Forms relevant to this specific appointment's stage — same matching
  // logic the practitioner side uses (FormTemplate.session_types), so a
  // client sees exactly the forms tied to that appointment, not every form
  // on their record.
  const sessionForms = formTemplates.filter(
    (t) => t.session_types?.includes(s.session_type) && t.active
  );

  async function playOrDownload(rec: Recording) {
    setPlayingId(rec.id);
    try {
      const url = await getPortalRecordingUrlAction(clientId, rec.id);
      if (url) window.open(url, "_blank");
    } finally {
      setPlayingId(null);
    }
  }

  return (
    <li className="border-b border-ink-100 pb-3 last:border-0">
      <div className="flex items-start justify-between gap-3 text-sm">
        <div>
          <div className="font-medium text-ink-800">{sessionTypeLabel(s.session_type)}</div>
          <div className="flex items-center gap-3 text-xs text-ink-500 mt-1">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> {formatDateTime(s.scheduled_at)}
            </span>
            {s.duration_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {s.duration_minutes} min
              </span>
            )}
            {s.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {s.location}
              </span>
            )}
          </div>
        </div>
        <span className={cx("badge capitalize shrink-0", SESSION_STATUS_BADGE[s.status])}>
          {s.status.replace(/_/g, " ")}
        </span>
      </div>
      {callSummaries.length > 0 && (
        <div className="mt-2 space-y-1">
          {callSummaries.map((cs) => (
            <div key={cs.id}>
              <button
                onClick={() => setExpanded(expanded === cs.id ? null : cs.id)}
                className="flex items-center gap-1.5 text-xs text-plum-600 hover:text-plum-700 font-medium"
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                Client Journey Summary
                <span className="ml-0.5">{expanded === cs.id ? "▲" : "▼"}</span>
              </button>
              {expanded === cs.id && (
                <div className="mt-2 space-y-2 text-sm text-ink-700 bg-ink-50/60 rounded-xl p-3">
                  {typeof cs.content.summary === "string" && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-ink-400 mb-1">Summary</div>
                      <p className="whitespace-pre-wrap">{cs.content.summary}</p>
                    </div>
                  )}
                  {typeof cs.content.action_items === "string" && cs.content.action_items !== "None mentioned." && (
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-ink-400 mb-1">Action Items</div>
                      <p className="whitespace-pre-wrap">{cs.content.action_items}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {s.transcript && s.transcript.trim() && (
        <div className="mt-2">
          <button
            onClick={() => setTranscriptOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-800 font-medium"
          >
            <ScrollText className="h-3.5 w-3.5" />
            Session Transcript
            <span className="ml-0.5">{transcriptOpen ? "▲" : "▼"}</span>
          </button>
          {transcriptOpen && (
            <div className="mt-2 text-sm text-ink-700 bg-ink-50/60 rounded-xl p-3 max-h-64 overflow-y-auto">
              <p className="whitespace-pre-wrap">{s.transcript}</p>
            </div>
          )}
        </div>
      )}

      {recordings.length > 0 && (
        <div className="mt-2 space-y-1">
          {recordings.map((rec) => (
            <button
              key={rec.id}
              onClick={() => playOrDownload(rec)}
              disabled={playingId === rec.id}
              className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-800 font-medium disabled:opacity-50"
            >
              <Music className="h-3.5 w-3.5" />
              {playingId === rec.id ? "Opening…" : `Play Recording${rec.file_name ? ` — ${rec.file_name}` : ""}`}
            </button>
          ))}
        </div>
      )}

      {sessionForms.length > 0 && (
        <div className="mt-2 space-y-1">
          {sessionForms.map((tmpl) => {
            const doc = documents.find((d) => d.document_type === tmpl.document_type);
            const sub = doc ? formSubmissions.find((fs) => fs.document_id === doc.id) : undefined;
            const status = sub?.status ?? (doc ? doc.status : "missing");
            const isComplete = status === "signed" || status === "submitted";
            const isOpen = doc ? openFormDocId === doc.id : false;
            return (
              <div key={tmpl.id}>
                <button
                  onClick={() => doc && isComplete && setOpenFormDocId(isOpen ? null : doc.id)}
                  className={cx(
                    "flex items-center gap-1.5 text-xs font-medium",
                    isComplete ? "text-plum-600 hover:text-plum-700" : "text-ink-400"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  {tmpl.title}
                  <span className={cx("badge", isComplete ? "bg-sage-100 text-sage-700" : "bg-ink-100 text-ink-500")}>
                    {isComplete ? "Submitted" : status === "in_progress" || status === "draft" ? "In progress" : "Not started"}
                  </span>
                  {isComplete && <span className="ml-0.5">{isOpen ? "▲" : "▼"}</span>}
                </button>
                {isOpen && doc && (
                  <div className="mt-2">
                    <FormRenderer
                      template={tmpl}
                      submission={sub}
                      clientId={clientId}
                      documentId={doc.id}
                      readOnly
                      packageValue={packageValue}
                      prefill={prefill}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}

function PlanList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-400 mb-1">{title}</div>
      <ul className="list-disc list-inside text-ink-700 space-y-0.5">
        {items.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function FormDocumentCard({
  clientId,
  document: doc,
  template,
  submission,
  packageValue,
  prefill,
  onChanged,
}: {
  clientId: string;
  document: ClientDocument;
  template: FormTemplate;
  submission?: FormSubmission;
  packageValue?: number;
  prefill?: FormPrefill;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const status = submission?.status ?? "missing";
  const isSubmitted = status === "signed" || status === "submitted";
  const statusBadge =
    status === "signed"
      ? { label: "Signed", cls: "bg-sage-100 text-sage-700" }
      : status === "submitted"
        ? { label: "Submitted", cls: "bg-sage-100 text-sage-700" }
        : (status === "in_progress" || status === "draft")
          ? { label: "In Progress", cls: "bg-amber-100 text-amber-700" }
          : { label: "Not Started", cls: "bg-ink-100 text-ink-500" };

  // When editing a submitted form, pass a modified copy with status reset so
  // FormRenderer doesn't lock the fields (it locks on "submitted"/"signed").
  const submissionForRenderer =
    editing && submission
      ? { ...submission, status: "in_progress" as const, submitted_at: undefined, signed_at: undefined }
      : submission;

  return (
    <div className="border border-ink-100 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex-1 flex items-center gap-2.5 text-left hover:text-ink-900 transition-colors"
        >
          <FileText className="h-4 w-4 text-ink-400 shrink-0" />
          <span className="text-sm font-medium text-ink-800">{DOCUMENT_LABELS[doc.document_type] ?? template.title}</span>
          <span className={cx("badge", statusBadge.cls)}>{statusBadge.label}</span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {isSubmitted && (
            <button
              onClick={() => { setEditing(true); setOpen(true); }}
              className="flex items-center gap-1 text-xs text-ink-500 hover:text-clay-600 px-2 py-1 rounded-lg hover:bg-clay-50 transition-colors"
              title="Edit this form"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
          <button onClick={() => setOpen((o) => !o)} className="p-1 text-ink-400 hover:text-ink-700">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4">
          <FormRenderer
            template={template}
            submission={submissionForRenderer}
            clientId={clientId}
            documentId={doc.id}
            packageValue={packageValue}
                      prefill={prefill}
            live={status === "in_progress"}
            onPoll={() => getFormSubmissionAction(doc.id)}
            editorLabel="your practitioner"
            onSaveProgress={async (answers) => {
              await saveFormProgressAction(clientId, doc.id, template.id, answers);
            }}
            onSubmit={async (answers, signed) => {
              await submitClientFormAction(clientId, doc.id, template.id, answers, signed);
              setEditing(false);
              onChanged();
            }}
          />
        </div>
      )}
    </div>
  );
}

function CheckInCard({ clientId, checkIn, onSaved }: { clientId: string; checkIn?: CheckIn; onSaved: () => void }) {
  const [fields, setFields] = useState({
    emotional_state: checkIn?.emotional_state ?? "",
    physical_state: checkIn?.physical_state ?? "",
    immediate_insights: checkIn?.immediate_insights ?? "",
    support_needs: checkIn?.support_needs ?? "",
    safety_concerns: checkIn?.safety_concerns ?? "",
  });
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(!!checkIn);

  return (
    <div className="card p-5 space-y-3">
      <h2 className="font-semibold text-ink-900">12-Hour Check-In</h2>
      {(Object.keys(fields) as (keyof typeof fields)[]).map((k) => (
        <div key={k}>
          <label className="text-sm font-medium text-ink-800 capitalize">{k.replace(/_/g, " ")}</label>
          <textarea
            value={fields[k]}
            onChange={(e) => setFields((s) => ({ ...s, [k]: e.target.value }))}
            rows={2}
            className="mt-1 w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
          />
        </div>
      ))}
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await submitCheckInAction(clientId, fields, "client");
            setDone(true);
            onSaved();
          })
        }
        className="btn-primary w-full text-sm flex items-center justify-center gap-2"
      >
        <CheckCircle2 className="h-4 w-4" /> {done ? "Update Check-In" : "Submit Check-In"}
      </button>
    </div>
  );
}

function MessagesPanel({ clientId, messages, onSent }: { clientId: string; messages: Message[]; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="card p-5 flex flex-col h-[60vh]">
      <h2 className="font-semibold text-ink-900 mb-3">Messages with your Practitioner</h2>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.map((m) => (
          <div key={m.id} className={cx("max-w-[80%] rounded-2xl px-3 py-2 text-sm", m.sender === "client" ? "bg-clay-500 text-white ml-auto" : "bg-ink-100 text-ink-800")}>
            {m.body}
            <div className={cx("text-[10px] mt-1", m.sender === "client" ? "text-clay-100" : "text-ink-400")}>{formatDate(m.created_at)}</div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-sm text-ink-400">No messages yet.</p>}
      </div>
      <div className="flex gap-2 mt-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
        />
        <button
          disabled={!body.trim() || pending}
          onClick={() =>
            startTransition(async () => {
              await sendMessageAction(clientId, "client", body);
              setBody("");
              onSent();
            })
          }
          className="btn-primary px-3"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Shown when getPortalBundleAction reports the client's data is locked —
// i.e. the requester isn't a previewing practitioner and isn't logged in as
// this client yet. Renders a "create your account" form the very first time
// (accountExists === false), or a login form on every later visit — the
// unlock cookie is session-only, so this reappears each time the client
// reopens their portal link in a fresh browser session.
function PortalAuthGate({
  clientId,
  accountExists,
  clientEmail,
  onUnlocked,
}: {
  clientId: string;
  accountExists: boolean;
  clientEmail?: string;
  onUnlocked: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="card p-6 w-full max-w-sm space-y-4 text-center">
        <div className="h-10 w-10 rounded-lg bg-clay-500 text-white flex items-center justify-center mx-auto">
          <HeartHandshake className="h-5 w-5" />
        </div>
        {accountExists ? (
          <PortalLoginForm clientId={clientId} clientEmail={clientEmail} onUnlocked={onUnlocked} />
        ) : (
          <PortalCreateAccountForm clientId={clientId} clientEmail={clientEmail} onUnlocked={onUnlocked} />
        )}
      </div>
    </div>
  );
}

function PortalLoginForm({
  clientId,
  clientEmail,
  onUnlocked,
}: {
  clientId: string;
  clientEmail?: string;
  onUnlocked: () => void;
}) {
  const [email, setEmail] = useState(clientEmail ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await portalLoginAction(clientId, email, password);
    if (result.ok) {
      onUnlocked();
    } else {
      setBusy(false);
      setError("Incorrect email or password.");
    }
  }

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Log in to your portal</h1>
        <p className="text-sm text-ink-500 mt-1">For your privacy, you&apos;ll need to log in each time you visit.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
        />
        {error && <p className="text-xs text-clay-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !email.trim() || !password}
          className="btn-primary text-sm px-4 py-2 w-full disabled:opacity-50"
        >
          {busy ? "Logging in..." : "Log in"}
        </button>
        <p className="text-xs text-ink-400">
          Forgot your password? Ask your practitioner to reset it, then come back to this link to set a new one.
        </p>
      </form>
    </>
  );
}

function PortalCreateAccountForm({
  clientId,
  clientEmail,
  onUnlocked,
}: {
  clientId: string;
  clientEmail?: string;
  onUnlocked: () => void;
}) {
  const [email, setEmail] = useState(clientEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const result = await createPortalAccountAction(clientId, email, password);
    if (result.ok) {
      onUnlocked();
    } else {
      setBusy(false);
      setError(result.error ?? "Something went wrong. Please try again.");
    }
  }

  return (
    <>
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Set up your portal account</h1>
        <p className="text-sm text-ink-500 mt-1">Choose an email and password — you&apos;ll use these to log in each time you visit.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3 text-left">
        <input
          type="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (6+ characters)"
          className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          className="w-full border border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clay-200"
        />
        {error && <p className="text-xs text-clay-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !email.trim() || password.length < 6 || !confirm}
          className="btn-primary text-sm px-4 py-2 w-full disabled:opacity-50"
        >
          {busy ? "Setting up..." : "Create my account"}
        </button>
      </form>
    </>
  );
}
