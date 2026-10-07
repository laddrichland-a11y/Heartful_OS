"use client";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import HeartfulBrand from "@/components/ui/HeartfulBrand";
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
  editSentMessageAction,
  deleteSentMessageAction,
  submitCheckInAction,
  saveFormProgressAction,
  submitClientFormAction,
  getFormSubmissionAction,
  getPortalRecordingUrlAction,
  markPortalWelcomeSeenAction,
  markPortalAgreementsOpenedAction,
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
import { AlertCircle, Check, CheckCircle2, Send, Sparkles, FileText, ChevronDown, ChevronUp, CalendarDays, MapPin, Clock, Pencil, Trash2, MessageSquareText, Mail, Music, UserRound, LayoutDashboard, ListChecks, Sprout, PanelLeftClose, PanelLeftOpen, Settings, ArrowRight } from "@/components/ui/HeartfulIcon";
import { formatDate, formatDateTime, getClientJourneyProgress, journeyStageStatusLabel, relativeDueLabel, cx, isGeneralPaperwork, phaseForStatus } from "@/lib/utils";
import { selectCurrentOrNextSession, selectSessionTimeline } from "@/lib/sessionSelectors";
import JourneyProgressBar from "@/components/JourneyProgressBar";
import FormRenderer from "@/components/forms/FormRenderer";
import { buildFormPrefill, FormPrefill } from "@/lib/formPrefill";
import PortalWelcome from "@/components/portal/PortalWelcome";
import PortalClientSettings from "@/components/portal/PortalClientSettings";
import SidebarNatureMessage from "@/components/layout/SidebarNatureMessage";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  AGREEMENT_STATE_LABELS,
  agreementStateForDocument,
  normalizeAgreementItem,
  normalizeAgreementStatus,
  type AgreementItemState,
} from "@/lib/agreementStatus";
import { formTemplateAppliesToSession, resolveRequiredForms } from "@/lib/requiredForms";

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
type PortalTab = (typeof TABS)[number] | "Settings";

const PORTAL_PAGE_TITLES: Record<PortalTab, string> = {
  Home: "Home",
  Appointments: "Appointments",
  "Forms & Check-Ins": "Forms & Check-Ins",
  "Growth & Integration": "Growth & Integration",
  Messages: "Messages",
  Settings: "Settings",
};

const PORTAL_NAV = [
  { label: "Home", icon: LayoutDashboard },
  { label: "Appointments", icon: CalendarDays },
  { label: "Forms & Check-Ins", icon: ListChecks },
  { label: "Growth & Integration", icon: Sprout },
  { label: "Messages", icon: MessageSquareText },
] as const;

const ASSIGNMENT_TYPE_LABELS: Record<PortalAssignment["assignment_type"], string> = {
  form: "Form",
  homework: "Homework",
  journaling_prompt: "Journal prompt",
  integration_exercise: "Integration exercise",
  action_item: "Action item",
};

function assignmentStatusLabel(status: PortalAssignment["status"]) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

function formAssignmentActionLabel(status: PortalAssignment["status"]) {
  if (status === "completed") return "Review";
  if (status === "in_progress") return "Continue";
  return "Start";
}

const PORTAL_SIDEBAR_COLLAPSED_KEY = "heartful-portal-sidebar-collapsed";

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
  const [portalNow, setPortalNow] = useState(Date.now);
  // Set once ?client=<id> is confirmed dead. Holds who to contact, and
  // whether the viewer is the practitioner (who needs a way out, not a
  // "contact your practitioner" message).
  const [linkInvalid, setLinkInvalid] = useState<{
    isPractitioner: boolean;
    practitionerName?: string;
    practitionerEmail?: string;
  } | null>(null);
  const [tab, setTab] = useState<PortalTab>("Home");
  const [portalSidebarCollapsed, setPortalSidebarCollapsed] = useState(false);
  const [portalClientSwitcherOpen, setPortalClientSwitcherOpen] = useState(false);
  const [portalClientListOpen, setPortalClientListOpen] = useState(false);
  const [portalViewMenuOpen, setPortalViewMenuOpen] = useState(false);
  const [showAllAssignments, setShowAllAssignments] = useState(false);
  const portalAccountMenuRef = useRef<HTMLDivElement>(null);
  const portalViewMenuRef = useRef<HTMLDivElement>(null);
  const returningToPractitionerRef = useRef(false);

  /* Browser storage is an external preference source, synchronized after the
     initial server render to avoid a hydration mismatch. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      setPortalSidebarCollapsed(window.localStorage.getItem(PORTAL_SIDEBAR_COLLAPSED_KEY) === "true");
    } catch {
      // Keep the sidebar expanded when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setPortalNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!portalClientSwitcherOpen) return;

    function closePortalAccountMenu(event: PointerEvent) {
      if (!portalAccountMenuRef.current?.contains(event.target as Node)) {
        setPortalClientSwitcherOpen(false);
        setPortalClientListOpen(false);
      }
    }

    function closePortalAccountMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPortalClientSwitcherOpen(false);
        setPortalClientListOpen(false);
      }
    }

    document.addEventListener("pointerdown", closePortalAccountMenu);
    document.addEventListener("keydown", closePortalAccountMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closePortalAccountMenu);
      document.removeEventListener("keydown", closePortalAccountMenuOnEscape);
    };
  }, [portalClientSwitcherOpen]);

  useEffect(() => {
    if (!portalViewMenuOpen) return;

    function closePortalViewMenu(event: PointerEvent) {
      if (!portalViewMenuRef.current?.contains(event.target as Node)) {
        setPortalViewMenuOpen(false);
      }
    }

    function closePortalViewMenuOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPortalViewMenuOpen(false);
    }

    document.addEventListener("pointerdown", closePortalViewMenu);
    document.addEventListener("keydown", closePortalViewMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closePortalViewMenu);
      document.removeEventListener("keydown", closePortalViewMenuOnEscape);
    };
  }, [portalViewMenuOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function togglePortalSidebar() {
    setPortalSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(PORTAL_SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // The control still works for the current page without persistence.
      }
      return next;
    });
  }

  function returnToPractitionerView() {
    // A portal URL can carry ?client=<id>, whose initialization effect would
    // otherwise immediately restore client mode before navigation completes.
    returningToPractitionerRef.current = true;
    setPortalViewMenuOpen(false);
    setPortalClientSwitcherOpen(false);
    setPortalClientListOpen(false);
    setRole("practitioner");
    setIsPreview(false);
    setPortalClientId("");
    router.replace("/dashboard");
  }
  // Practitioner-preview escape hatch for the agreements gate below. Real
  // clients never get this — for them the gate is the whole portal until
  // the paperwork is signed.
  const [previewSkipGate, setPreviewSkipGate] = useState(false);
  // Welcome page: null = follow the client record, true/false = this session's
  // override (dismissed just now, or re-opened via the header link).
  const [welcomeOverride, setWelcomeOverride] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();
  // Local/Codex runs are a practitioner sandbox even when the browser last
  // visited a real-looking client URL. Keep preview controls available there,
  // while production client deep links remain free of practitioner actions.
  const canUsePortalPreviewControls = isPreview || process.env.NODE_ENV === "development";

  // Intro emails link straight to a specific client's portal via
  // /portal?client=<id>. That link is the only "auth" a client has, so it
  // must win over whatever role/client was previously active on this
  // device/browser — otherwise a fresh browser session (role defaults to
  // "practitioner") bounces straight back to /dashboard before this effect
  // ever gets a chance to flip into client mode.
  useEffect(() => {
    if (returningToPractitionerRef.current) return;
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
    if (hydrated && (!portalClientId || isPreview)) {
      listClientsForPortalAction().then(setClients);
    }
  }, [hydrated, portalClientId, isPreview]);

  useEffect(() => {
    if (portalClientId) {
      getPortalBundleAction(portalClientId).then((b) => {
        if ("locked" in b && b.locked) {
          setAuthGate({ accountExists: b.accountExists });
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

  // This hook must stay above the loading, invalid-link and authentication
  // returns below. The portal can move between those states after hydration,
  // and conditionally calling it later would change PortalPageInner's hook
  // order and crash the entire page.
  useEffect(() => {
    if (!bundle?.client || isPreview || process.env.NODE_ENV === "development") return;
    const agreements = normalizeAgreementStatus({
      client: bundle.client,
      templates: bundle.formTemplates,
      documents: bundle.documents,
      submissions: bundle.formSubmissions,
    });
    if (agreements.outstanding_count > 0) void markPortalAgreementsOpenedAction(portalClientId);
  }, [bundle, isPreview, portalClientId]);

  // Nothing role-dependent can be rendered before hydration either — the
  // demo picker below keys off portalClientId, which is "" until then, so a
  // returning client would flash the practitioner-only client list.
  if (!hydrated) {
    return <div className="portal-shell min-h-screen flex items-center justify-center text-ink-400 text-sm">Loading your portal...</div>;
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
      <div className="auth-shell min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          <div className="portal-auth-brand"><HeartfulBrand subtitle="Your Journey Portal" /></div>
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
                  onClick={returnToPractitionerView}
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
      <div className="portal-shell min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
        <div className="card p-8 max-w-md w-full text-center space-y-4">
          <div className="portal-auth-brand"><HeartfulBrand subtitle="Your Journey Portal" /></div>
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
          {canUsePortalPreviewControls && (
            <div className="flex justify-center pt-2">
              <PractitionerViewReturn onReturn={returnToPractitionerView} />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (authGate) {
    return (
      <PortalAuthGate
        clientId={portalClientId}
        accountExists={authGate.accountExists}
        onReturnToPractitioner={canUsePortalPreviewControls ? returnToPractitionerView : undefined}
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
    return <div className="portal-shell min-h-screen flex items-center justify-center text-ink-400 text-sm">Loading your portal...</div>;
  }

  const { client } = bundle;
  // Name/email/phone we already hold, used to prefill matching fields on
  // every form the client opens instead of asking them to retype it.
  const prefill = buildFormPrefill(client, bundle.practitioner);
  const pendingTasks = bundle.tasks.filter((t) => t.status !== "completed");
  const pendingAssignments = bundle.assignments.filter((a) => a.status !== "completed");
  const visibleAssignments = showAllAssignments ? bundle.assignments : bundle.assignments.slice(0, 3);
  // Forms/consents are tracked separately from Task records (they're
  // auto-attached documents, not tasks), so the Action Items list has to
  // pull them in explicitly — otherwise a client with zero tasks but
  // unsubmitted forms incorrectly sees "all caught up".
  const requiredForms = resolveRequiredForms({
    templates: bundle.formTemplates,
    documents: bundle.documents,
    submissions: bundle.formSubmissions,
    currentPhase: phaseForStatus(client.status, client.current_phase),
  });
  const incompleteForms = requiredForms.filter((form) => !form.complete);
  const hasActionItems = pendingTasks.length > 0 || pendingAssignments.length > 0 || incompleteForms.length > 0;
  const journeyProgress = getClientJourneyProgress(client, bundle.milestones);
  const currentJourneyStage = journeyProgress.stages.find((stage) => stage.status === "current") ?? journeyProgress.stages.at(-1);
  const nextJourneyStage = journeyProgress.stages.find((stage) => stage.status === "upcoming");
  const nextSession = selectCurrentOrNextSession(bundle.sessions, portalNow);
  const homeActions = [
    ...incompleteForms.map((form) => ({
      id: `form-${form.document?.id ?? form.documentType}`,
      title: form.title,
      status: form.state === "missing_template" || form.state === "missing_document"
        ? "Waiting for practitioner"
        : form.state === "in_progress" ? "In progress" : "Not started",
      action: form.state === "in_progress" ? "Continue" : "Review",
      onClick: () => setTab("Forms & Check-Ins"),
      overdue: false,
    })),
    ...pendingAssignments.map((assignment) => ({
      id: `assignment-${assignment.id}`,
      title: assignment.title,
      status: relativeDueLabel(assignment.due_at),
      action: "Review",
      onClick: () => setTab("Forms & Check-Ins"),
      overdue: relativeDueLabel(assignment.due_at).toLowerCase().includes("overdue"),
    })),
    ...pendingTasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title.replace(/^Collect\s+/i, ""),
      status: relativeDueLabel(task.due_at),
      action: "Mark done",
      onClick: () => startTransition(async () => { await completeTaskAction(task.id, portalClientId); refresh(); }),
      overdue: relativeDueLabel(task.due_at).toLowerCase().includes("overdue"),
    })),
  ].filter((item, index, items) => items.findIndex((candidate) => candidate.title.toLowerCase() === item.title.toLowerCase()) === index).slice(0, 4);
  const refresh = () => getPortalBundleAction(portalClientId).then((b) => setBundle(b as Bundle));

  // -------------------------------------------------------------------------
  // ONBOARDING GATE — the practice-wide agreements come before anything else.
  //
  // These three are the paperwork a client signs once, on joining. Until
  // they're done the portal shows nothing but them: no tabs, no journey, no
  // messages. Signing all three drops the gate permanently.
  // -------------------------------------------------------------------------
  const agreementStatus = normalizeAgreementStatus({
    client,
    templates: bundle.formTemplates,
    documents: bundle.documents,
    submissions: bundle.formSubmissions,
  });
  const agreementItems = agreementStatus.items;
  const agreementsDone = agreementStatus.completed_count;
  const agreementsOutstanding = agreementStatus.outstanding_count;

  // This bypass is deliberately limited to an explicit practitioner preview.
  // A real client must always complete the required agreements.
  const canSkipAgreementReview = isPreview;

  if (agreementItems.length > 0 && agreementsOutstanding > 0 && (!isPreview || !previewSkipGate)) {
    const practitionerName = bundle.practitioner?.full_name ?? "your practitioner";
    const practitionerEmail = bundle.practitioner?.email;
    return (
      <div className="portal-shell portal-onboarding app-frame heartful-site-shell flex min-h-screen bg-[var(--background)]">
        <PortalSidebar
          activeTab={tab}
          collapsed={portalSidebarCollapsed}
          agreementMode
          onToggle={togglePortalSidebar}
          onTabChange={(nextTab) => setTab(nextTab)}
        />
        <div className="portal-workspace-frame flex-1 min-w-0">
        <header className="portal-onboarding-header portal-mobile-header">
          <div className="portal-onboarding-header__inner justify-between gap-4">
            <div className="portal-onboarding-brand">
              <HeartfulBrand subtitle="Your Journey Portal" />
            </div>
            {canUsePortalPreviewControls && <PractitionerViewReturn onReturn={returnToPractitionerView} />}
          </div>
        </header>

        <main className="portal-onboarding-main">
          <div className="portal-onboarding-intro">
            <div className="portal-onboarding-step-row">
              <p className="portal-onboarding-step">Step 1 of {agreementItems.length} · Agreements</p>
              {canUsePortalPreviewControls && <PractitionerViewReturn onReturn={returnToPractitionerView} className="portal-onboarding-return" label="Practitioner View" />}
            </div>
            <h1>Welcome, {client.full_name.split(" ")[0]}</h1>
            <p>Review and sign these agreements before continuing to your journey portal. They explain how we&apos;ll work together and what to expect.</p>
          </div>

          <section className="portal-agreements-surface">
            <div className="portal-agreements-surface__header">
              <div>
                <h2>Your agreements</h2>
                <p>{agreementsDone} of {agreementItems.length} completed</p>
              </div>
            </div>
            <div className="portal-agreements-progress" aria-label={`${agreementsDone} of ${agreementItems.length} agreements completed`}>
              <div
                className="portal-agreements-progress__value"
                style={{ width: `${(agreementsDone / agreementItems.length) * 100}%` }}
              />
            </div>
            <div className="portal-agreements-list">
              {agreementItems.map((item) => item.document ? (
                <FormDocumentCard
                  key={item.document.id}
                  clientId={portalClientId}
                  document={item.document}
                  template={item.template}
                  submission={item.submission}
                  agreementState={item.state}
                  packageValue={client.package_value}
                  prefill={prefill}
                  onChanged={refresh}
                  variant="onboarding"
                />
              ) : (
                <div key={item.template.id} className="portal-agreement-row is-pending">
                  <div className="portal-agreement-row__summary">
                    <span className="portal-agreement-row__icon"><FileText aria-hidden="true" /></span>
                    <span className="portal-agreement-row__copy">
                      <span className="portal-agreement-row__title"><strong>{item.template.title}</strong><span className="portal-agreement-status is-pending">{AGREEMENT_STATE_LABELS.not_opened}</span></span>
                      <small>Waiting to be assigned by your practitioner</small>
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="portal-agreements-footer">
              <div className="portal-agreements-support">
                <strong>Have a question before signing?</strong>
                {practitionerEmail ? (
                  <a href={`mailto:${practitionerEmail}?subject=${encodeURIComponent("Question about my agreements")}`}><Mail aria-hidden="true" />Message {practitionerName}</a>
                ) : (
                  <span>Message {practitionerName}</span>
                )}
              </div>
              {canSkipAgreementReview && (
                <button onClick={() => setPreviewSkipGate(true)} className="portal-preview-skip">
                  Skip (preview only) <span aria-hidden="true">→</span>
                </button>
              )}
            </div>
          </section>
        </main>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // WELCOME — the first thing they see once the agreements are behind them.
  // Shown once (portal_welcome_seen_at is unset), then reachable on demand
  // from the header link. Preview mode never auto-shows it, so the
  // practitioner isn't stopped by it every time they look at a client.
  // -------------------------------------------------------------------------
  // Codex and the external browser keep separate local sessions. Avoid
  // diverting the local development view to the one-time welcome screen so
  // both open the actual portal Home by default.
  const welcomeUnseen = !client.portal_welcome_seen_at && !isPreview && process.env.NODE_ENV !== "development";
  const showWelcome = welcomeOverride ?? welcomeUnseen;

  if (showWelcome) {
    return (
      <div className="portal-shell min-h-screen bg-[var(--background)]">
        <header className="bg-white border-b border-ink-100">
          <div className="portal-onboarding-header__inner justify-between gap-4">
            <div className="portal-onboarding-brand">
              <HeartfulBrand subtitle="Your Journey Portal" />
            </div>
            {canUsePortalPreviewControls && <PractitionerViewReturn onReturn={returnToPractitionerView} />}
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
    <div className="portal-shell app-frame heartful-site-shell flex min-h-screen bg-[var(--background)]">
      <PortalSidebar
        activeTab={tab}
        collapsed={portalSidebarCollapsed}
        onToggle={togglePortalSidebar}
        onTabChange={(nextTab) => setTab(nextTab)}
      />

      <div className={cx("portal-workspace-frame flex-1 min-w-0", tab === "Messages" && "portal-workspace-frame--messages")}>
      <header className="app-topbar portal-app-header sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-ink-100">
        <div className="flex items-center justify-between px-4 md:px-7 py-3.5">
          <h1 className="app-page-title portal-app-header__title">{PORTAL_PAGE_TITLES[tab]}</h1>
          <div className="topbar-actions">
            {canUsePortalPreviewControls && (
              <div className="topbar-view-menu" ref={portalViewMenuRef}>
                <button
                  type="button"
                  className="topbar-view-trigger"
                  aria-haspopup="menu"
                  aria-expanded={portalViewMenuOpen}
                  onClick={() => setPortalViewMenuOpen((open) => !open)}
                >
                  <span>{role === "practitioner" ? "Practitioner View" : "Client Portal View"}</span>
                  <ChevronDown aria-hidden="true" />
                </button>
                {portalViewMenuOpen && (
                  <div className="topbar-popover topbar-view-options" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      data-selected={role === "practitioner"}
                      onClick={returnToPractitionerView}
                    >
                      <span><strong>Practitioner View</strong><small>Manage your practice</small></span>
                      {role === "practitioner" && <Check aria-hidden="true" />}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      data-selected={role === "client"}
                      onClick={() => {
                        setRole("client");
                        setIsPreview(true);
                        setPortalViewMenuOpen(false);
                      }}
                    >
                      <span><strong>Client Portal View</strong><small>Preview the client experience</small></span>
                      {role === "client" && <Check aria-hidden="true" />}
                    </button>
                  </div>
                )}
              </div>
            )}
            {canUsePortalPreviewControls && <span className="topbar-action-divider" />}
            <div className="topbar-account" ref={portalAccountMenuRef}>
              <button
                type="button"
                className="topbar-account-trigger"
                aria-label="Client portal menu"
                aria-haspopup="menu"
                aria-expanded={portalClientSwitcherOpen}
                onClick={() => {
                  setPortalClientSwitcherOpen((open) => !open);
                  if (portalClientSwitcherOpen) setPortalClientListOpen(false);
                }}
              >
                <span className="topbar-avatar" aria-hidden="true">
                  {client.full_name.split(" ").map((name) => name[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
              {portalClientSwitcherOpen && (
                <div className="topbar-popover topbar-account-menu portal-client-account-menu" role="menu">
                  <div className="topbar-account-summary">
                    <span className="topbar-avatar" aria-hidden="true">
                      {client.full_name.split(" ").map((name) => name[0]).join("").slice(0, 2).toUpperCase()}
                    </span>
                    <span><strong>{client.full_name}</strong><small>Client portal</small></span>
                  </div>
                  <button type="button" role="menuitem" onClick={() => { setPortalClientSwitcherOpen(false); setWelcomeOverride(true); }}>
                    <AlertCircle aria-hidden="true" /><span>About this portal</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setPortalClientSwitcherOpen(false); setTab("Settings"); }}>
                    <Settings aria-hidden="true" /><span>Edit client account</span>
                  </button>
                  {canUsePortalPreviewControls && (
                    <>
                      <button type="button" role="menuitem" aria-expanded={portalClientListOpen} onClick={() => setPortalClientListOpen((open) => !open)}>
                        <UserRound aria-hidden="true" /><span>Switch client</span><ChevronDown className="portal-client-account-chevron" aria-hidden="true" />
                      </button>
                      {portalClientListOpen && (
                        <div className="portal-client-account-options" role="group" aria-label="Choose client">
                          {clients.map((portalClient) => (
                            <button
                              key={portalClient.id}
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setPortalClientSwitcherOpen(false);
                                setPortalClientListOpen(false);
                                setPortalClientId(portalClient.id);
                              }}
                              data-current={portalClient.id === portalClientId ? "true" : undefined}
                            >
                              <span className="topbar-client-avatar" aria-hidden="true">
                                {portalClient.full_name.split(" ").map((name) => name[0]).join("").slice(0, 2).toUpperCase()}
                              </span>
                              <span>{portalClient.full_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="portal-main">
        <div className="portal-workspace-heading">
          <div>
            {tab === "Home" && <h1>Welcome back, {client.full_name.split(" ")[0]}</h1>}
          </div>
        </div>
        {tab === "Settings" && (
          <PortalClientSettings
            key={client.id}
            client={client}
            onSaved={refresh}
            onViewAgreements={() => setTab("Forms & Check-Ins")}
          />
        )}
        {tab === "Home" && (
          <div className="portal-overview">
            <section className="card p-5 portal-journey-card">
              <div className="portal-section-heading">
                <div className="portal-heading-with-icon"><span className="portal-heading-icon"><Sprout aria-hidden="true" /></span><h2>Your Journey</h2></div>
                {nextJourneyStage && <span className="portal-phase-label">Next: {nextJourneyStage.label}</span>}
              </div>
              <div className="portal-journey-summary">
                <div>
                  <span>Journey stage</span>
                  <div className="portal-current-step-line"><strong>{currentJourneyStage?.label ?? "Your journey"}</strong><span className="portal-phase-label">{client.status === "inactive" ? "Inactive" : journeyStageStatusLabel(currentJourneyStage?.status ?? "future")}</span></div>
                </div>
                <div className="portal-journey-progress-copy"><strong>{journeyProgress.completed} of {journeyProgress.total}</strong><span>completed</span></div>
              </div>
              <JourneyProgressBar client={client} milestones={bundle.milestones} compact />
              <button type="button" className="portal-journey-continue" onClick={() => setTab("Forms & Check-Ins")}>Continue journey <ArrowRight aria-hidden="true" /></button>
            </section>
            <div className="portal-home-secondary-grid">
            <section className="card p-5 portal-next-session-card">
              <div className="portal-section-heading">
                <div className="portal-heading-with-icon"><span className="portal-heading-icon"><Clock aria-hidden="true" /></span><h2>Next session</h2></div>
              </div>
              {nextSession ? (
                <div className="portal-next-session-content">
                  <div><span className="portal-next-session-date"><CalendarDays aria-hidden="true" /><strong>{formatDateTime(nextSession.scheduled_at)}</strong></span><span>{sessionTypeLabel(nextSession.session_type)} · {bundle.practitioner?.full_name ?? "Your practitioner"}{nextSession.location && ` · ${nextSession.location}`}</span></div>
                  <button type="button" onClick={() => setTab("Appointments")}>View appointment <ArrowRight aria-hidden="true" /></button>
                </div>
              ) : (
                <p className="text-sm text-ink-400">No upcoming session is scheduled yet.</p>
              )}
            </section>
            <section className="card p-5 portal-actions-card">
              <div className="portal-section-heading">
                <div className="portal-heading-with-icon"><span className="portal-heading-icon"><ListChecks aria-hidden="true" /></span><h2>To do</h2>{hasActionItems && <span className="portal-count">{pendingTasks.length + pendingAssignments.length + incompleteForms.length}</span>}</div>
              </div>
              {!hasActionItems ? <p className="text-sm text-ink-400">You&apos;re all caught up — nothing pending right now.</p> : (
                <ul className="portal-action-list">
                  {homeActions.map((item) => <li key={item.id}><div><strong>{item.title}</strong><span className={item.overdue ? "portal-action-overdue" : undefined}>{item.status}</span></div><button type="button" onClick={item.onClick}>{item.action} <ArrowRight aria-hidden="true" /></button></li>)}
                </ul>
              )}
              {hasActionItems && <button type="button" className="portal-view-all-tasks" onClick={() => setTab("Forms & Check-Ins")}>View all tasks <ArrowRight aria-hidden="true" /></button>}
            </section>
            </div>
          </div>
        )}

        {tab === "Appointments" && (
          <AppointmentsPanel
            clientId={portalClientId}
            now={portalNow}
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
          <div className="portal-content-grid">
            <div className="card p-5 portal-content-grid__primary">
              <h2 className="portal-forms-section-title font-semibold text-ink-900 mb-3"><FileText aria-hidden="true" />Required Forms &amp; Consents</h2>
              {bundle.documents.filter((d) => bundle.formTemplates.some((t) => t.document_type === d.document_type)).length === 0 &&
              requiredForms.every((form) => form.state !== "missing_template" && form.state !== "missing_document") ? (
                <p className="text-sm text-ink-400">Nothing to fill out right now.</p>
              ) : (
                <div className="space-y-2">
                  {requiredForms
                    .filter((form) => form.state === "missing_template" || form.state === "missing_document")
                    .map((form) => (
                      <div key={form.documentType} className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-3 text-sm text-ink-700">
                        <strong className="block font-medium text-ink-900">{form.title}</strong>
                        <span>This required form needs to be added by your practitioner before you can complete it.</span>
                      </div>
                    ))}
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
                          agreementState={agreementStateForDocument(doc, bundle.formTemplates, bundle.formSubmissions)}
                          packageValue={client.package_value}
              prefill={prefill}
                          onChanged={refresh}
                        />
                      );
                    })}
                </div>
              )}
            </div>
            <div className="card p-5 portal-content-grid__side">
              <h2 className="portal-forms-section-title font-semibold text-ink-900 mb-3"><ListChecks aria-hidden="true" />Assigned Forms &amp; Homework</h2>
              {bundle.assignments.length === 0 ? (
                <p className="text-sm text-ink-400">No assignments waiting on you.</p>
              ) : (
                <>
                  <ul className="portal-assignment-list">
                    {visibleAssignments.map((assignment) => {
                      const isForm = assignment.assignment_type === "form";
                      const status = assignmentStatusLabel(assignment.status);
                      const formAction = formAssignmentActionLabel(assignment.status);
                      return (
                        <li key={assignment.id} className="portal-assignment-row">
                          <div className="portal-assignment-copy">
                            <strong>{assignment.title}</strong>
                            {assignment.description && <p>{assignment.description}</p>}
                            <div className="portal-assignment-meta">
                              <span className="portal-assignment-type">{ASSIGNMENT_TYPE_LABELS[assignment.assignment_type]}</span>
                              <span className={cx("portal-assignment-status", status === "In progress" && "is-progress", status === "Completed" && "is-complete")}>{status}</span>
                            </div>
                          </div>
                          {isForm ? (
                            <button type="button" className="portal-assignment-form-action" onClick={() => setTab("Forms & Check-Ins")}>
                              {formAction}<ArrowRight aria-hidden="true" />
                            </button>
                          ) : assignment.status === "completed" ? (
                            <span className="portal-assignment-completed"><CheckCircle2 aria-hidden="true" />Completed</span>
                          ) : (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => startTransition(async () => {
                                await completePortalAssignmentAction(assignment.id, portalClientId);
                                refresh();
                              })}
                              className="btn-secondary portal-assignment-complete"
                            >
                              <CheckCircle2 aria-hidden="true" />Mark Done
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {bundle.assignments.length > 3 && (
                    <button type="button" className="portal-assignment-view-all" onClick={() => setShowAllAssignments((showingAll) => !showingAll)}>
                      {showAllAssignments ? "Show less" : "View all"}<ArrowRight aria-hidden="true" />
                    </button>
                  )}
                </>
              )}
            </div>
            {/* The 12-Hour Check-In is now a regular form (listed with the other
                forms). This older card only shows if that form is switched off. */}
            {!bundle.formTemplates.some((t) => t.document_type === "check_in_12hr_form" && t.active) &&
              (bundle.checkIns.length > 0 || PHASE_ORDER.indexOf(client.current_phase) >= PHASE_ORDER.indexOf("post_journey_check_in")) && (
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
                <p className="text-sm text-ink-400">Your Growth Action Plan will appear here after Integration Session 2.</p>
              )}
            </div>
          </div>
        )}

        {tab === "Messages" && <MessagesPanel clientId={portalClientId} messages={bundle.messages} onSent={refresh} />}
      </main>
      </div>
      <PortalMobileTabBar activeTab={tab} onTabChange={(nextTab) => setTab(nextTab)} />
    </div>
  );
}

/** Phone-only bottom tab bar — the sidebar is hidden below md, so without this
 *  a client on their phone had no way to switch sections. */
function PortalMobileTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: PortalTab;
  onTabChange: (tab: (typeof TABS)[number]) => void;
}) {
  const shortLabels: Record<string, string> = {
    Home: "Home",
    Appointments: "Appointments",
    "Forms & Check-Ins": "Forms",
    "Growth & Integration": "Growth",
    Messages: "Messages",
  };
  return (
    <nav className="portal-mobile-tabbar md:hidden" aria-label="Client portal sections">
      {PORTAL_NAV.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.label;
        return (
          <button
            type="button"
            key={item.label}
            onClick={() => onTabChange(item.label)}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            data-active={active ? "true" : "false"}
          >
            <Icon aria-hidden="true" />
            <span>{shortLabels[item.label] ?? item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function PortalSidebar({
  activeTab,
  collapsed,
  agreementMode = false,
  onToggle,
  onTabChange,
}: {
  activeTab: PortalTab;
  collapsed: boolean;
  agreementMode?: boolean;
  onToggle: () => void;
  onTabChange: (tab: (typeof TABS)[number]) => void;
}) {
  return (
    <aside
      className="app-sidebar portal-sidebar relative hidden min-h-screen w-60 shrink-0 self-start transition-[width] duration-200 md:flex md:flex-col sticky top-0"
      data-collapsed={collapsed ? "true" : "false"}
    >
      <button
        type="button"
        className="sidebar-collapse-button"
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        aria-controls="client-portal-navigation"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
      </button>

      <button type="button" onClick={() => !agreementMode && onTabChange("Home")} className="sidebar-brand flex items-center gap-2 px-5 py-5 transition-colors" aria-label="Heartful client portal home">
        <HeartfulBrand subtitle="Your Journey Portal" />
      </button>

      <nav id="client-portal-navigation" className="sidebar-nav flex-1 px-3 py-4 space-y-1" aria-label="Client portal navigation">
        {agreementMode && (
          <button type="button" data-active="true" aria-current="step" className="portal-sidebar-nav-item">
            <span className="sidebar-icon-box" aria-hidden="true"><ListChecks /></span>
            <span className="sidebar-label">Agreements</span>
          </button>
        )}
        {PORTAL_NAV.map((item) => {
          const Icon = item.icon;
          const active = !agreementMode && activeTab === item.label;
          return (
            <button
              type="button"
              key={item.label}
              onClick={() => onTabChange(item.label)}
              disabled={agreementMode}
              data-active={active ? "true" : "false"}
              aria-current={active ? "page" : undefined}
              aria-label={agreementMode ? `${item.label} — available after agreements` : item.label}
              title={collapsed ? item.label : undefined}
              className="portal-sidebar-nav-item"
            >
              <span className="sidebar-icon-box" aria-hidden="true"><Icon /></span>
              <span className="sidebar-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer px-5 py-4 border-t border-ink-100 text-xs text-ink-400">
        <SidebarNatureMessage />
      </div>

    </aside>
  );
}

function PractitionerViewReturn({ onReturn, className, label }: { onReturn: () => void; className?: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={onReturn}
      className={className ?? "btn-secondary inline-flex items-center gap-2 whitespace-nowrap px-3 py-2 text-sm"}
      aria-label={label ?? "Back to Practitioner View"}
    >
      <LayoutDashboard aria-hidden="true" />
      <span>{label ?? "Back to Practitioner View"}</span>
    </button>
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
  integration_1: "Integration Session 1",
  integration_2: "Integration Session 2",
};

function sessionTypeLabel(type: Session["session_type"]) {
  return SESSION_TYPE_DISPLAY_LABELS[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function AppointmentsPanel({
  clientId,
  now,
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
  now: number;
  sessions: Session[];
  sessionCallSummaries: AiSummary[];
  recordings: Recording[];
  formTemplates: FormTemplate[];
  documents: ClientDocument[];
  formSubmissions: FormSubmission[];
  packageValue?: number;
  prefill?: FormPrefill;
}) {
  // Use the same future-date boundary as the portal home, dashboard and
  // calendar. `now` is owned by the parent state so render remains pure.
  const { activeAndUpcoming: upcoming, history: past } = selectSessionTimeline(sessions, now);

  return (
    <div className="portal-appointments-grid">
      <div className="card p-5">
        <h2 className="portal-appointments-heading font-semibold mb-3 flex items-center gap-2">
          <CalendarDays className="h-4 w-4" aria-hidden="true" /> Upcoming Appointments
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
        <h2 className="portal-appointments-heading font-semibold mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" aria-hidden="true" /> Past Appointments
        </h2>
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
      <StageRecordingsCard clientId={clientId} recordings={recordings.filter((r) => !r.session_id)} />
    </div>
  );
}

const STAGE_RECORDING_LABELS: Record<string, string> = {
  intake: "Intake & Assessment",
  preparation: "Preparation",
  journey_day: "Journey Day",
  check_in_12hr: "12-Hour Check-In",
  integration_1: "Integration Session 1",
  integration_2: "Integration Session 2",
  growth_plan: "Growth Plan",
};

// Recordings your practitioner added on a stage page rather than to a
// specific appointment — listed on their own so none go missing.
function StageRecordingsCard({ clientId, recordings }: { clientId: string; recordings: Recording[] }) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  if (recordings.length === 0) return null;

  async function play(rec: Recording) {
    setPlayingId(rec.id);
    try {
      const url = await getPortalRecordingUrlAction(clientId, rec.id);
      if (url) window.open(url, "_blank");
    } finally {
      setPlayingId(null);
    }
  }

  return (
    <div className="card p-5">
      <h2 className="portal-appointments-heading font-semibold mb-3 flex items-center gap-2">
        <Music className="h-4 w-4" aria-hidden="true" /> Session Recordings
      </h2>
      <ul className="space-y-2">
        {recordings.map((rec) => (
          <li key={rec.id} className="flex flex-wrap items-center gap-2 text-sm">
            <button
              type="button"
              onClick={() => play(rec)}
              disabled={playingId === rec.id}
              className="flex items-center gap-1.5 text-xs text-ink-600 hover:text-ink-900 font-medium disabled:opacity-50"
            >
              <Music className="h-3.5 w-3.5" aria-hidden="true" />
              {playingId === rec.id ? "Opening…" : `Play Recording${rec.file_name ? ` — ${rec.file_name}` : ""}`}
            </button>
            <span className="text-xs text-ink-400">
              {rec.stage ? STAGE_RECORDING_LABELS[rec.stage] ?? "" : ""} · {formatDateTime(rec.created_at)}
            </span>
          </li>
        ))}
      </ul>
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
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [openFormDocId, setOpenFormDocId] = useState<string | null>(null);

  // Forms relevant to this specific appointment's stage — same matching
  // logic the practitioner side uses (FormTemplate.session_types), so a
  // client sees exactly the forms tied to that appointment, not every form
  // on their record.
  const sessionForms = formTemplates.filter(
    (template) => formTemplateAppliesToSession(template, s.session_type)
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
    <li className="portal-session-row">
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
                      <div className="text-xs uppercase tracking-wide text-ink-400 mb-1">Summary</div>
                      <p className="whitespace-pre-wrap">{cs.content.summary}</p>
                    </div>
                  )}
                  {typeof cs.content.action_items === "string" && cs.content.action_items !== "None mentioned." && (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-ink-400 mb-1">Action Items</div>
                      <p className="whitespace-pre-wrap">{cs.content.action_items}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
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
            const agreement = isGeneralPaperwork(tmpl.document_type)
              ? normalizeAgreementItem(tmpl, doc, sub)
              : undefined;
            const isComplete = agreement?.complete ?? (status === "signed" || status === "submitted");
            const displayStatus = agreement
              ? AGREEMENT_STATE_LABELS[agreement.state]
              : isComplete
                ? "Submitted"
                : status === "in_progress" || status === "draft" ? "In progress" : "Not started";
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
                  <span className={cx(
                    "badge",
                    isComplete
                      ? "bg-sage-100 text-sage-700"
                      : agreement?.state === "opened"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-ink-100 text-ink-500",
                  )}>
                    {displayStatus}
                  </span>
                  {isComplete && (isOpen ? (
                    <ChevronUp className="ml-0.5 h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="ml-0.5 h-3.5 w-3.5" aria-hidden="true" />
                  ))}
                </button>
                {isOpen && doc && (
                  <div className="mt-2">
                    <FormRenderer
                      template={tmpl}
                      submission={sub}
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
    <div className="portal-plan-section">
      <div className="text-xs uppercase tracking-wide text-ink-400 mb-1">{title}</div>
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
  agreementState,
  packageValue,
  prefill,
  onChanged,
  variant = "default",
}: {
  clientId: string;
  document: ClientDocument;
  template: FormTemplate;
  submission?: FormSubmission;
  agreementState?: AgreementItemState;
  packageValue?: number;
  prefill?: FormPrefill;
  onChanged: () => void;
  variant?: "default" | "onboarding";
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const status = submission?.status ?? "missing";
  // A form the practitioner already marked reviewed/signed (e.g. completed on
  // paper or in session) counts as done here too — otherwise the portal says
  // "Not Started" while the practitioner side says "Reviewed".
  const practitionerCompleted = !submission && (doc.status === "signed" || doc.status === "reviewed");
  const isSubmitted = agreementState === "completed" || status === "signed" || status === "submitted" || practitionerCompleted;
  const statusBadge =
    agreementState === "completed" || practitionerCompleted
      ? { label: AGREEMENT_STATE_LABELS.completed, cls: "bg-sage-100 text-sage-700" }
      : agreementState === "opened"
        ? { label: AGREEMENT_STATE_LABELS.opened, cls: "bg-amber-100 text-amber-700" }
        : agreementState === "not_opened"
          ? { label: AGREEMENT_STATE_LABELS.not_opened, cls: "bg-ink-100 text-ink-500" }
          : status === "signed"
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

  if (variant === "onboarding") {
    const actionLabel = isSubmitted ? "Completed" : agreementState === "opened" || status === "in_progress" || status === "draft" ? "Continue" : "Review";
    const supportingText = isSubmitted ? "Completed" : agreementState === "opened" || status === "in_progress" || status === "draft" ? "Continue where you left off" : "Read and sign";
    return (
      <div className={cx("portal-agreement-row", open && "is-open", isSubmitted && "is-complete")}>
        <button onClick={() => setOpen((current) => !current)} className="portal-agreement-row__summary" aria-expanded={open}>
          <span className="portal-agreement-row__icon"><FileText aria-hidden="true" /></span>
          <span className="portal-agreement-row__copy">
            <span className="portal-agreement-row__title"><strong>{DOCUMENT_LABELS[doc.document_type] ?? template.title}</strong><span className={cx("portal-agreement-status", isSubmitted ? "is-complete" : agreementState === "opened" || status === "in_progress" || status === "draft" ? "is-progress" : "is-pending")}>{statusBadge.label}</span></span>
            <small>{supportingText}</small>
          </span>
        </button>
        <div className="portal-agreement-row__actions">
          {isSubmitted ? (
            <span className="portal-agreement-action is-complete"><CheckCircle2 aria-hidden="true" /> {actionLabel}</span>
          ) : (
            <button onClick={() => setOpen(true)} className="portal-agreement-action">{actionLabel} <span aria-hidden="true">→</span></button>
          )}
        </div>
        {open && (
          <div className="portal-agreement-row__form">
            <FormRenderer
              template={template}
              submission={submissionForRenderer}
              documentId={doc.id}
              packageValue={packageValue}
              prefill={prefill}
              live={status === "in_progress"}
              onPoll={() => getFormSubmissionAction(doc.id)}
              editorLabel="your practitioner"
              onSaveProgress={async (answers) => { await saveFormProgressAction(clientId, doc.id, template.id, answers); }}
              onSubmit={async (answers, signed) => { await submitClientFormAction(clientId, doc.id, template.id, answers, signed); setEditing(false); onChanged(); }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="portal-document-row overflow-hidden">
      <div className="portal-document-row__header flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex-1 flex items-center gap-2.5 text-left hover:text-ink-900 transition-colors"
        >
          <FileText className="h-4 w-4 text-ink-400 shrink-0" />
          <span className="text-sm font-medium text-ink-800">{DOCUMENT_LABELS[doc.document_type] ?? template.title}</span>
          <span className={cx("badge", statusBadge.cls)}>{statusBadge.label}</span>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          {isSubmitted && submission && (
            <button
              onClick={() => { setEditing(true); setOpen(true); }}
              className="flex items-center gap-1 text-xs text-ink-500 hover:text-clay-600 px-2 py-1 rounded-lg hover:bg-clay-50 transition-colors"
              title="Edit this form"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
          <button onClick={() => setOpen((o) => !o)} className="portal-agreement-action" aria-expanded={open}>
            {open ? "Close" : isSubmitted ? "View" : agreementState === "opened" || status === "in_progress" || status === "draft" ? "Continue" : "Review"}
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4">
          <FormRenderer
            template={template}
            submission={submissionForRenderer}
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
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [messageOverrides, setMessageOverrides] = useState<Record<string, Message>>({});
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messageError, setMessageError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const visibleMessages = messages
    .filter((message) => !deletedIds.includes(message.id))
    .map((message) => messageOverrides[message.id] ?? message);

  async function saveEdit(messageId: string) {
    if (!editDraft.trim()) return;
    setBusyId(messageId);
    setMessageError("");
    try {
      const updated = await editSentMessageAction(clientId, messageId, "client", editDraft);
      setMessageOverrides((current) => ({ ...current, [messageId]: updated }));
      setEditingId(null);
      onSent();
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Could not edit the message.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemoveMessage() {
    if (!pendingDeleteId) return;
    const messageId = pendingDeleteId;
    setBusyId(messageId);
    setMessageError("");
    try {
      await deleteSentMessageAction(clientId, messageId, "client");
      setDeletedIds((current) => [...current, messageId]);
      if (editingId === messageId) setEditingId(null);
      onSent();
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "Could not delete the message.");
    } finally {
      setBusyId(null);
      setPendingDeleteId(null);
    }
  }

  return (
    <div className="card p-5 portal-messages-panel flex flex-col h-[60vh]">
      <h2 className="font-semibold text-ink-900 mb-3">Messages with your Practitioner</h2>
      <div className="message-thread-scroll flex-1 overflow-y-auto space-y-2 pr-1">
        {visibleMessages.map((m) => (
          <div key={m.id} className={cx("max-w-[80%] break-words rounded-2xl px-3 py-2 text-sm", m.sender === "client" ? "bg-clay-500 text-white ml-auto" : "bg-ink-100 text-ink-800")}>
            {editingId === m.id ? (
              <div className="space-y-2">
                <textarea
                  value={editDraft}
                  onChange={(event) => setEditDraft(event.target.value)}
                  rows={6}
                  aria-label="Edit message"
                  className="min-h-36 w-full resize-y rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-ink-900 focus:outline-none focus:ring-2 focus:ring-clay-200"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingId(null)} disabled={busyId === m.id} className="text-xs text-white/80 hover:text-white">Cancel</button>
                  <button type="button" onClick={() => saveEdit(m.id)} disabled={!editDraft.trim() || busyId === m.id} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-clay-700 disabled:opacity-60">Save</button>
                </div>
              </div>
            ) : <div className="whitespace-pre-wrap">{m.body}</div>}
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className={cx("text-xs", m.sender === "client" ? "text-white/70" : "text-ink-400")}>{formatDate(m.created_at)}{m.edited_at ? " · Edited" : ""}</span>
              {m.sender === "client" && editingId !== m.id && (
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => { setEditingId(m.id); setEditDraft(m.body); setMessageError(""); }} disabled={busyId === m.id} aria-label="Edit message" title="Edit message" className="rounded p-1 text-white/75 hover:bg-white/15 hover:text-white disabled:opacity-50"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setPendingDeleteId(m.id)} disabled={busyId === m.id} aria-label="Delete message" title="Delete message" className="rounded p-1 text-white/75 hover:bg-white/15 hover:text-white disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              )}
            </div>
          </div>
        ))}
        {visibleMessages.length === 0 && <p className="text-sm text-ink-400">No messages yet.</p>}
      </div>
      {messageError && <p role="alert" className="mt-2 text-xs text-red-600">{messageError}</p>}
      <div className="mt-3 flex items-end gap-2">
        <textarea
          ref={composerRef}
          value={body}
          onChange={(event) => {
            setBody(event.target.value);
            resizePortalMessageComposer(event.currentTarget);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (!body.trim() || pending) return;
            startTransition(async () => {
              await sendMessageAction(clientId, "client", body);
              setBody("");
              composerRef.current?.style.removeProperty("height");
              onSent();
            });
          }}
          rows={1}
          placeholder="Type a message..."
          aria-label="Type a message"
          className="message-composer min-h-10 max-h-36 flex-1 resize-none overflow-y-auto rounded-xl border border-ink-200 px-3 py-2 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-clay-200"
        />
        <button
          aria-label="Send message"
          disabled={!body.trim() || pending}
          onClick={() =>
            startTransition(async () => {
              await sendMessageAction(clientId, "client", body);
              setBody("");
              composerRef.current?.style.removeProperty("height");
              onSent();
            })
          }
          className="btn-primary px-3"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this message?"
        description="This action cannot be undone."
        confirmLabel="Delete message"
        busy={pendingDeleteId !== null && busyId === pendingDeleteId}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => void confirmRemoveMessage()}
      />
    </div>
  );
}

function resizePortalMessageComposer(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
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
  onReturnToPractitioner,
}: {
  clientId: string;
  accountExists: boolean;
  clientEmail?: string;
  onUnlocked: () => void;
  onReturnToPractitioner?: () => void;
}) {
  return (
    <div className="auth-shell min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="card p-6 w-full max-w-sm space-y-4 text-center">
        <div className="portal-auth-brand"><HeartfulBrand subtitle="Your Journey Portal" /></div>
        {accountExists ? (
          <PortalLoginForm clientId={clientId} clientEmail={clientEmail} onUnlocked={onUnlocked} />
        ) : (
          <PortalCreateAccountForm clientId={clientId} clientEmail={clientEmail} onUnlocked={onUnlocked} />
        )}
        {onReturnToPractitioner && (
          <div className="flex justify-center pt-1">
            <PractitionerViewReturn onReturn={onReturnToPractitioner} />
          </div>
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
