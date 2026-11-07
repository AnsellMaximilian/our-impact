"use client";

import { useActionState, useEffect, useId, useMemo, useOptimistic, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bot,
  BookOpen,
  Braces,
  Check,
  ChevronRight,
  Code2,
  Download,
  ExternalLink,
  FlaskConical,
  Gift,
  KeyRound,
  LoaderCircle,
  Plus,
  Radio,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Webhook,
  X,
} from "lucide-react";
import {
  addEntitlementRule,
  applyAssistantProposal,
  askEntitlementAssistant,
  createEntitlement,
  sendTestDonation,
  setEntitlementState,
  type AssistantState,
  type EntitlementStudioState,
  type TestEventState,
} from "@/app/dashboard/developers/actions";
import { AllowedOriginsForm, RotateKeyForm, WebhookForm } from "@/components/developer-forms";
import { CopyValueButton } from "@/components/copy-value-button";
import { FormMessage } from "@/components/form-message";
import { Sheet } from "@/components/sheet";
import { SubmitButton } from "@/components/submit-button";
import { formatEntitlementRule } from "@/lib/ai/entitlement-assistant";

type Rule = {
  id: string;
  entitlement_id: string;
  name: string;
  metric: string;
  threshold: number;
  amount_threshold_minor: number | null;
  currency: string | null;
  evaluation_window: string;
  state: string;
};

type Definition = {
  id: string;
  name: string;
  entitlement_key: string;
  description: string;
  state: string;
};

type Supporter = {
  id: string;
  external_user_id: string;
  display_name: string | null;
  created_at: string;
  last_seen_at: string;
};

type DeveloperEvent = {
  id: string;
  supporter_id: string;
  event_type: string;
  occurred_at: string;
  source: string;
};

type UserEntitlement = {
  id: string;
  supporter_id: string;
  entitlement_key: string;
  state: string;
  qualifying_count: number;
  progress_value: number;
  progress_unit: string;
  valid_until: string | null;
};

type WorkspaceProps = {
  project: {
    id: string;
    name: string;
    publishable_key: string;
    allowed_origins: string[];
    environment: string;
  };
  definitions: Definition[];
  rules: Rule[];
  supporters: Supporter[];
  userEntitlements: UserEntitlement[];
  eventCount: number;
  events: DeveloperEvent[];
  keys: Array<{
    id: string;
    key_prefix: string;
    last_four: string;
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
  }>;
  endpoints: Array<{ id: string; url: string; description: string | null; state: string }>;
  deliveries: Array<{
    id: string;
    event_type: string;
    status: string;
    response_status: number | null;
    created_at: string;
  }>;
  openRouterReady: boolean;
  openRouterModel: string | null;
};

type Tab = "overview" | "entitlements" | "users" | "api" | "test";

const tabs: Array<{ id: Tab; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "entitlements", label: "Entitlements", icon: BadgeCheck },
  { id: "users", label: "Users", icon: Users },
  { id: "api", label: "API & webhooks", icon: Braces },
  { id: "test", label: "Test console", icon: FlaskConical },
];

function ruleSummary(rule: Rule) {
  if (rule.metric === "event_count") {
    return `${rule.threshold} verified donation${rule.threshold === 1 ? "" : "s"} ${rule.evaluation_window === "calendar_month" ? "per calendar month" : "over the shopper’s lifetime"}`;
  }
  const amount = ((rule.amount_threshold_minor ?? 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: rule.currency ?? "USD",
  });
  if (rule.metric === "single_amount") {
    const window = rule.evaluation_window === "calendar_month"
      ? "during the calendar month"
      : rule.evaluation_window === "lifetime"
        ? "over the shopper’s lifetime"
        : "in this event";
    return `One verified donation of ${amount} or more ${window}`;
  }
  return `${amount} total ${rule.evaluation_window === "calendar_month" ? "per calendar month" : "over the shopper’s lifetime"}`;
}

const entitlementArt = [
  "/illustrations/entitlement-community-champion.png",
  "/illustrations/entitlement-monthly-supporter.png",
  "/illustrations/entitlement-generous-neighbor.png",
] as const;

function illustrationForEntitlement(key: string) {
  const hash = [...key].reduce((total, character) => total + character.charCodeAt(0), 0);
  return entitlementArt[hash % entitlementArt.length] ?? entitlementArt[0];
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(new Date(value));
}

function Stat({ icon: Icon, value, label }: { icon: typeof Users; value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-ink/8">
      <Icon className="size-4 text-coral-dark" />
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      <p className="text-xs font-medium text-ink-soft">{label}</p>
    </div>
  );
}

function RuleFields({ prefix = "" }: { prefix?: string }) {
  const [metric, setMetric] = useState("event_count");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="sm:col-span-2">
        <span className="mb-2 block text-sm font-semibold">Rule label</span>
        <input name={`${prefix}rule_name`} required defaultValue="Two donations this month" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" />
      </label>
      <label>
        <span className="mb-2 block text-sm font-semibold">Measure</span>
        <select name={`${prefix}metric`} value={metric} onChange={(event) => setMetric(event.target.value)} className="min-h-11 w-full rounded-xl border border-line bg-white px-3">
          <option value="event_count">Number of donations</option>
          <option value="single_amount">One donation amount</option>
          <option value="period_amount">Total donated amount</option>
        </select>
      </label>
      <label>
        <span className="mb-2 block text-sm font-semibold">Window</span>
        <select name={`${prefix}evaluation_window`} defaultValue={metric === "single_amount" ? "lifetime" : "calendar_month"} key={metric} className="min-h-11 w-full rounded-xl border border-line bg-white px-3">
          {metric === "single_amount" ? (
            <>
              <option value="lifetime">Lifetime</option>
              <option value="calendar_month">Calendar month</option>
              <option value="single_event">This event only</option>
            </>
          ) : (
            <>
              <option value="calendar_month">Calendar month</option>
              <option value="lifetime">Lifetime</option>
            </>
          )}
        </select>
      </label>
      {metric === "event_count" ? (
        <label className="sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">Required donations</span>
          <input type="number" name={`${prefix}threshold`} min={1} max={100000} defaultValue={2} required className="min-h-11 w-full rounded-xl border border-line bg-white px-3" />
        </label>
      ) : (
        <label className="sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">USD amount</span>
          <div className="flex min-h-11 items-center rounded-xl border border-line bg-white px-3"><span className="text-ink-soft">$</span><input name={`${prefix}amount`} inputMode="decimal" defaultValue="50.00" required className="min-h-10 flex-1 bg-transparent px-2 outline-none" /><span className="text-xs font-bold text-ink-soft">USD</span></div>
          <input type="hidden" name={`${prefix}threshold`} value="1" />
        </label>
      )}
    </div>
  );
}

function NewEntitlementForm({ projectId }: { projectId: string }) {
  const initial: EntitlementStudioState = {};
  const [state, action] = useActionState(createEntitlement, initial);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="project_id" value={projectId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-2 block text-sm font-semibold">Display name</span>
          <input name="name" required defaultValue="Generous Gary" className="min-h-11 w-full rounded-xl border border-line bg-white px-3" />
        </label>
        <label>
          <span className="mb-2 block text-sm font-semibold">SDK key</span>
          <input name="entitlement_key" required pattern="[a-z][a-z0-9_]{1,79}" defaultValue="generous_gary" className="min-h-11 w-full rounded-xl border border-line bg-white px-3 font-mono text-sm" />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-2 block text-sm font-semibold">What this unlocks</span>
          <textarea name="description" maxLength={280} rows={2} defaultValue="Unlocks Mike’s community champion theme." className="w-full rounded-xl border border-line bg-white px-3 py-2" />
        </label>
      </div>
      <div className="border-t border-line pt-5"><p className="mb-4 text-sm font-semibold">First earning path</p><RuleFields /></div>
      <FormMessage error={state.error} message={state.success} />
      <SubmitButton pendingLabel="Creating…">Create entitlement</SubmitButton>
    </form>
  );
}

function AddRuleForm({ projectId, definition }: { projectId: string; definition: Definition }) {
  const initial: EntitlementStudioState = {};
  const [state, action] = useActionState(addEntitlementRule, initial);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="entitlement_id" value={definition.id} />
      <RuleFields />
      <FormMessage error={state.error} message={state.success} />
      <SubmitButton pendingLabel="Adding…">Add earning path</SubmitButton>
    </form>
  );
}

function AnimatedModal({ trigger, title, description, children }: { trigger: React.ReactNode; title: string; description?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-4 sm:p-8" role="presentation">
          <button type="button" onClick={() => setOpen(false)} aria-label="Close modal" className="overlay-enter absolute inset-0 cursor-default bg-ink/55 backdrop-blur-[3px]" />
          <section role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} className="modal-enter relative z-10 my-auto w-full max-w-xl overflow-hidden rounded-[1.75rem] bg-paper shadow-[0_30px_100px_rgba(4,18,32,0.34)]">
            <header className="flex items-start justify-between gap-5 border-b border-ink/8 bg-white px-5 py-5 sm:px-7">
              <div><h2 id={titleId} className="display-type text-2xl font-semibold">{title}</h2>{description && <p id={descriptionId} className="mt-1 text-sm leading-6 text-ink-soft">{description}</p>}</div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close modal" className="grid size-10 shrink-0 place-items-center rounded-full border border-line bg-white text-ink-soft transition hover:text-ink"><X className="size-5" /></button>
            </header>
            <div className="max-h-[calc(100vh-10rem)] overflow-y-auto p-5 sm:p-7">{children}</div>
          </section>
        </div>
      )}
    </>
  );
}

function AddRuleModal({ projectId, definition }: { projectId: string; definition: Definition }) {
  return (
    <AnimatedModal
      title={`Add earning path to ${definition.name}`}
      description="Add another verified way for a customer to earn this entitlement."
      trigger={<button type="button" className="mt-4 inline-flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 text-left text-sm font-semibold transition hover:bg-paper"><span className="flex items-center gap-2"><Plus className="size-3.5" /> Add another earning path</span><ChevronRight className="size-3.5" /></button>}
    >
      <AddRuleForm projectId={projectId} definition={definition} />
    </AnimatedModal>
  );
}

function AssistantPanel({
  projectId,
  definitions,
  ready,
  model,
}: {
  projectId: string;
  definitions: Definition[];
  ready: boolean;
  model: string | null;
}) {
  type ChatMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    response?: NonNullable<AssistantState["response"]>;
    runId?: string;
  };

  const initialAssistant: AssistantState = {};
  const initialApply: EntitlementStudioState = {};
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (current, message: ChatMessage) => [...current, message],
  );
  const [assistantState, assistantAction, assistantPending] = useActionState(askEntitlementAssistant, initialAssistant);
  const [applyState, applyAction] = useActionState(applyAssistantProposal, initialApply);
  const [applyingRunId, setApplyingRunId] = useState<string | null>(null);
  const seenResponse = useRef<string | null>(null);
  const pendingUser = useRef<ChatMessage | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const responseKey = assistantState.responseId ?? (
      assistantState.error && pendingUser.current
        ? `error-${pendingUser.current.id}`
        : null
    );
    if (!responseKey || seenResponse.current === responseKey) return;

    seenResponse.current = responseKey;
    const submittedMessage = pendingUser.current;
    pendingUser.current = null;
    const assistantMessage: ChatMessage = assistantState.response
      ? {
          id: `assistant-${responseKey}`,
          role: "assistant",
          content: assistantState.response.message,
          response: assistantState.response,
          runId: assistantState.runId,
        }
      : {
          id: `assistant-${responseKey}`,
          role: "assistant",
          content: `${assistantState.error} Please check the request and try again; no entitlement was changed.`,
        };

    setMessages((current) => [
      ...current,
      ...(submittedMessage ? [submittedMessage] : []),
      assistantMessage,
    ]);
  }, [assistantState]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const thread = threadRef.current;
      if (!thread) return;
      thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [optimisticMessages.length, assistantPending, applyState.error, applyState.success]);

  function submit(formData: FormData) {
    const message = String(formData.get("message") ?? "").trim();
    if (!message) return;
    formData.set("history", JSON.stringify(messages.slice(-8).map(({ role, content }) => ({ role, content }))));
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };
    pendingUser.current = userMessage;
    addOptimisticMessage(userMessage);
    assistantAction(formData);
    formRef.current?.reset();
  }

  return (
    <section className="overflow-hidden rounded-[2rem] bg-ink text-white shadow-[0_25px_60px_rgba(16,38,63,0.18)]">
      <div className="flex flex-col gap-4 border-b border-white/10 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-mint"><Sparkles className="size-4" /> Rule assistant</p>
          <h2 className="mt-2 text-2xl font-semibold">Describe the customer experience you want.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">It checks your existing catalog, asks about ambiguity, and prepares a deterministic change for you to approve.</p>
        </div>
        <span className="w-fit rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70">{ready ? model ?? "OpenRouter ready" : "Setup required"}</span>
      </div>

      <div ref={threadRef} className="max-h-[32rem] min-h-64 space-y-4 overflow-y-auto p-6" aria-live="polite">
        {!optimisticMessages.length && !assistantPending && (
          <div className="rounded-2xl bg-white/8 p-4 text-sm leading-6 text-white/75">
            <p className="font-semibold text-white">Try a real request</p>
            <p className="mt-1">“If someone gives $50 or more, make them a Generous Guy.”</p>
          </div>
        )}
        {optimisticMessages.map((message) => {
          if (message.role === "user") {
            return <div key={message.id} className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-coral px-4 py-3 text-sm text-white shadow-sm">{message.content}</div>;
          }

          const proposal = message.response?.proposal ?? null;
          const referenced = definitions.filter((definition) =>
            message.response?.referenced_entitlement_ids.includes(definition.id),
          );
          const showApplyState = applyingRunId === message.runId;

          return (
            <div key={message.id} className="max-w-[96%] rounded-2xl rounded-bl-md bg-white/10 p-4 text-sm leading-6 text-white/85">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-mint/15 text-mint"><Bot className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <p>{message.content}</p>
                  {referenced.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {referenced.map((definition) => <span key={definition.id} className="inline-flex items-center gap-1.5 rounded-full bg-mint/15 px-3 py-1.5 text-xs font-semibold text-mint"><BadgeCheck className="size-3" /> Referenced: {definition.name}</span>)}
                    </div>
                  )}
                  {proposal && message.runId && (
                    <div className="mt-4 rounded-2xl bg-white p-5 text-ink shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-coral-dark">Review proposed change</p><h3 className="mt-2 text-xl font-semibold">{proposal.entitlement_name}</h3></div>
                        <span className="rounded-full bg-mint/15 px-3 py-1 text-xs font-bold text-mint-dark">{proposal.action === "use_existing" ? "Uses existing" : "Creates new"}</span>
                      </div>
                      <p className="mt-4 rounded-2xl bg-paper px-4 py-3 text-sm font-semibold">Earned after {formatEntitlementRule(proposal)}</p>
                      <div className="mt-4 grid gap-2 text-xs text-ink-soft sm:grid-cols-2">
                        <p><span className="font-semibold text-ink">SDK key:</span> <code>{proposal.entitlement_key}</code></p>
                        <p><span className="font-semibold text-ink">Event:</span> <code>{proposal.event_type}</code></p>
                      </div>
                      <form action={applyAction} onSubmit={() => setApplyingRunId(message.runId ?? null)} className="mt-5">
                        <input type="hidden" name="project_id" value={projectId} />
                        <input type="hidden" name="run_id" value={message.runId} />
                        {showApplyState && <FormMessage error={applyState.error} message={applyState.success} />}
                        {!(showApplyState && applyState.success) && <SubmitButton pendingLabel="Applying safely…"><Check className="size-4" /> Apply this change</SubmitButton>}
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {assistantPending && (
          <div className="max-w-[96%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 text-sm text-white/70">
            <div className="flex items-center gap-3"><span className="grid size-7 place-items-center rounded-full bg-mint/15 text-mint"><LoaderCircle className="size-4 animate-spin" /></span><span>Comparing your request with the entitlement catalog…</span></div>
          </div>
        )}
      </div>

      <form ref={formRef} action={submit} className="border-t border-white/10 p-4 sm:p-5">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="history" value="[]" />
        <div className="flex items-end gap-3 rounded-2xl bg-white p-2 text-ink">
          <textarea name="message" required minLength={2} maxLength={2000} rows={2} disabled={!ready || assistantPending} placeholder={ready ? "Describe an entitlement or earning rule…" : "Add the OpenRouter environment variables to use the assistant."} className="min-h-14 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none" />
          <button disabled={!ready || assistantPending} className="grid size-11 shrink-0 place-items-center rounded-xl bg-coral text-white transition hover:bg-coral-dark disabled:opacity-40" aria-label="Send request"><Send className="size-4" /></button>
        </div>
      </form>
    </section>
  );
}

function EntitlementsTab({ props }: { props: WorkspaceProps }) {
  const activeDefinitions = props.definitions.filter((definition) => definition.state === "active").length;
  const activeGrants = props.userEntitlements.filter((entitlement) => entitlement.state === "active").length;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-coral-dark">Product benefits</p><h2 className="display-type mt-1 text-3xl font-semibold sm:text-4xl">Entitlements</h2><p className="mt-2 text-sm text-ink-soft">Define the benefits your product can query after verified participation.</p></div>
        <Sheet
          title="Create entitlement"
          description="Define a product benefit and the first verified way a customer can earn it."
          trigger={
            <button type="button" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-semibold shadow-sm transition hover:border-ink/25 hover:bg-paper sm:w-auto">
              <Plus className="size-4" /> Create manually
            </button>
          }
        >
          <NewEntitlementForm projectId={props.project.id} />
        </Sheet>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={BadgeCheck} value={props.definitions.length} label="entitlement rules" />
        <Stat icon={ShieldCheck} value={activeDefinitions} label="active definitions" />
        <Stat icon={Gift} value={activeGrants} label="active grants" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.14fr)_minmax(360px,0.86fr)] xl:items-start">
        <div className="space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-coral-dark">Entitlement catalog</p><h3 className="mt-1 text-2xl font-semibold">Benefits your product can query</h3></div>
          {props.definitions.map((definition) => {
            const rules = props.rules.filter((rule) => rule.entitlement_id === definition.id);
            const activeUsers = props.userEntitlements.filter((item) => item.entitlement_key === definition.entitlement_key && item.state === "active").length;
            return (
              <article key={definition.id} className="dashboard-card overflow-hidden rounded-[1.5rem]">
                <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-0 sm:grid-cols-[132px_minmax(0,1fr)]">
                  <div className="p-3 pr-0 sm:p-4 sm:pr-0">
                    <div className="relative h-24 overflow-hidden rounded-2xl bg-[#e3eee3] sm:h-full sm:min-h-36"><Image src={illustrationForEntitlement(definition.entitlement_key)} alt="" fill sizes="132px" className="object-contain p-2" /></div>
                  </div>
                  <div className="min-w-0 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-lg font-semibold sm:text-xl">{definition.name}</h4><span className={definition.state === "active" ? "rounded-full bg-mint/15 px-2.5 py-1 text-xs font-bold text-mint-dark" : "rounded-full bg-ink/8 px-2.5 py-1 text-xs font-bold text-ink-soft"}>{definition.state}</span></div><code className="mt-1.5 block truncate text-xs text-ink-soft">{definition.entitlement_key}</code><p className="mt-2 line-clamp-2 text-sm leading-6 text-ink-soft">{definition.description || "No customer-facing description yet."}</p></div>
                      <div className="flex shrink-0 items-center gap-2"><span className="rounded-xl bg-paper px-3 py-2 text-xs font-semibold text-ink-soft">{activeUsers} active</span><form action={setEntitlementState}><input type="hidden" name="project_id" value={props.project.id} /><input type="hidden" name="entitlement_id" value={definition.id} /><input type="hidden" name="state" value={definition.state === "active" ? "disabled" : "active"} /><button className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold hover:bg-paper">{definition.state === "active" ? "Disable" : "Enable"}</button></form></div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">{rules.map((rule) => <span key={rule.id} title={rule.name} className="inline-flex rounded-full bg-paper px-3 py-1.5 text-xs font-semibold text-ink-soft">{ruleSummary(rule)}</span>)}</div>
                    <AddRuleModal projectId={props.project.id} definition={definition} />
                  </div>
                </div>
              </article>
            );
          })}
          {!props.definitions.length && <div className="rounded-3xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink-soft">No entitlements yet. Ask the assistant or create one manually.</div>}
        </div>
        <aside className="xl:sticky xl:top-5"><AssistantPanel projectId={props.project.id} definitions={props.definitions} ready={props.openRouterReady} model={props.openRouterModel} /></aside>
      </div>
    </div>
  );
}

function UserDetails({
  supporter,
  entitlements,
  events,
  mobile = false,
  onClose,
}: {
  supporter: Supporter;
  entitlements: UserEntitlement[];
  events: DeveloperEvent[];
  mobile?: boolean;
  onClose?: () => void;
}) {
  const active = entitlements.filter((entitlement) => entitlement.state === "active");
  const name = supporter.display_name ?? supporter.external_user_id;
  const initial = name.trim().slice(0, 1).toUpperCase();

  return (
    <div className={mobile ? "min-h-full bg-paper" : "dashboard-card overflow-hidden rounded-[1.5rem]"}>
      {mobile && (
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/10 bg-paper/95 px-4 py-3 backdrop-blur">
          <button type="button" onClick={onClose} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold"><ArrowLeft className="size-4" /> Project users</button>
          <button type="button" onClick={onClose} aria-label="Close user details" className="grid size-10 place-items-center rounded-full border border-ink/12 bg-white"><X className="size-4" /></button>
        </div>
      )}
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-mint/18 text-lg font-bold text-mint-dark">{initial}</span>
          <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.14em] text-mint-dark">Customer profile</p><h3 className="display-type mt-1 truncate text-2xl font-semibold sm:text-3xl">{name}</h3><code className="mt-1 block truncate text-xs text-ink-soft">{supporter.external_user_id}</code></div>
          <span className="rounded-full bg-mint/18 px-2.5 py-1 text-[11px] font-bold text-mint-dark">Active</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-paper p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft">First seen</p><p className="mt-1 text-sm font-semibold">{formatTimestamp(supporter.created_at)}</p></div>
          <div className="rounded-2xl bg-paper p-3"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-soft">Last activity</p><p className="mt-1 text-sm font-semibold">{formatTimestamp(supporter.last_seen_at)}</p></div>
        </div>
      </div>

      <section className="border-t border-ink/10 px-5 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-3"><h4 className="text-lg font-semibold">Current entitlements</h4><span className="text-xs font-semibold text-ink-soft">{active.length} active</span></div>
        {entitlements.length ? <div className="mt-3 space-y-2">{entitlements.map((entitlement) => <div key={entitlement.id} className="flex items-start gap-3 rounded-2xl bg-paper p-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mint/18 text-mint-dark"><BadgeCheck className="size-4" /></span><div className="min-w-0 flex-1"><code className="block truncate text-sm font-semibold text-ink">{entitlement.entitlement_key}</code><p className="mt-1 text-xs text-ink-soft">{entitlement.qualifying_count} qualifying event{entitlement.qualifying_count === 1 ? "" : "s"} · {entitlement.state}</p></div><span className={entitlement.state === "active" ? "rounded-full bg-mint/18 px-2 py-1 text-[10px] font-bold text-mint-dark" : "rounded-full bg-ink/8 px-2 py-1 text-[10px] font-bold text-ink-soft"}>{entitlement.state}</span></div>)}</div> : <p className="mt-3 text-sm text-ink-soft">No entitlement state has been evaluated yet.</p>}
      </section>

      <section className="border-t border-ink/10 px-5 py-5 sm:px-6">
        <h4 className="text-lg font-semibold">Recent verified activity</h4>
        {events.length ? <div className="mt-3 space-y-1">{events.slice(0, 6).map((event) => <div key={event.id} className="flex items-start gap-3 border-b border-ink/8 py-3 last:border-b-0"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-mint/14 text-mint-dark">{event.event_type.includes("donation") ? <Gift className="size-4" /> : <Activity className="size-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{event.event_type.replaceAll(".", " ")}</p><p className="mt-0.5 text-xs text-ink-soft">Verified via {event.source}</p></div><time className="shrink-0 text-[10px] font-medium text-ink-soft">{formatTimestamp(event.occurred_at)}</time></div>)}</div> : <p className="mt-3 text-sm text-ink-soft">No verified activity recorded for this user yet.</p>}
      </section>
    </div>
  );
}

function UsersTab({ props }: { props: WorkspaceProps }) {
  const [selectedId, setSelectedId] = useState(props.supporters[0]?.id ?? null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = props.supporters.find((supporter) => supporter.id === selectedId) ?? props.supporters[0] ?? null;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return props.supporters;
    return props.supporters.filter((supporter) => `${supporter.display_name ?? ""} ${supporter.external_user_id}`.toLowerCase().includes(normalized));
  }, [props.supporters, query]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [mobileOpen]);

  function selectSupporter(supporter: Supporter) {
    setSelectedId(supporter.id);
    if (window.matchMedia("(max-width: 1023px)").matches) setMobileOpen(true);
  }

  if (!selected) return <div className="rounded-3xl border border-dashed border-ink/20 p-10 text-center"><UserRound className="mx-auto size-8 text-mint-dark" /><p className="mt-4 font-semibold">No identified users yet</p><p className="mt-2 text-sm text-ink-soft">Use the Test console or connect an identified widget to create the first profile.</p></div>;

  const selectedEntitlements = props.userEntitlements.filter((item) => item.supporter_id === selected.id);
  const selectedEvents = props.events.filter((event) => event.supporter_id === selected.id);

  return (
    <div className="space-y-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-coral-dark">Customer identity</p><h2 className="display-type mt-1 text-3xl font-semibold sm:text-4xl">Project users</h2><p className="mt-2 text-sm text-ink-soft">External customer identities and the product benefits they currently hold.</p></div>
      <div className="grid gap-3 sm:grid-cols-3"><Stat icon={Users} value={props.supporters.length} label="known users" /><Stat icon={Activity} value={new Set(props.events.map((event) => event.supporter_id)).size} label="recently active" /><Stat icon={BadgeCheck} value={new Set(props.userEntitlements.filter((item) => item.state === "active").map((item) => item.supporter_id)).size} label="with entitlements" /></div>
      <label className="flex min-h-12 max-w-xl items-center gap-3 rounded-2xl border border-line bg-white px-4"><Search className="size-4 text-ink-soft" /><span className="sr-only">Search project users</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or external ID…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)] lg:items-start">
        <div className="dashboard-card overflow-hidden rounded-[1.5rem]">
          {filtered.map((supporter) => {
            const roles = props.userEntitlements.filter((item) => item.supporter_id === supporter.id && item.state === "active");
            const active = supporter.id === selected.id;
            return <button key={supporter.id} type="button" onClick={() => selectSupporter(supporter)} className={`grid w-full gap-3 border-b border-ink/8 p-4 text-left transition last:border-b-0 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)_auto] sm:items-center ${active ? "bg-mint/10" : "hover:bg-paper"}`}><div className="min-w-0"><p className="truncate font-semibold">{supporter.display_name ?? supporter.external_user_id}</p><code className="mt-1 block truncate text-xs text-ink-soft">{supporter.external_user_id}</code></div><div className="flex flex-wrap gap-1.5">{roles.length ? roles.slice(0, 3).map((role) => <span key={role.id} className="rounded-full bg-mint/18 px-2.5 py-1 text-[11px] font-semibold text-mint-dark">{role.entitlement_key}</span>) : <span className="text-xs text-ink-soft">No active entitlements</span>}</div><span className="text-xs font-medium text-ink-soft">{formatTimestamp(supporter.last_seen_at)}</span></button>;
          })}
          {!filtered.length && <p className="p-8 text-center text-sm text-ink-soft">No users match that search.</p>}
        </div>
        <aside className="sticky top-5 hidden lg:block"><UserDetails supporter={selected} entitlements={selectedEntitlements} events={selectedEvents} /></aside>
      </div>

      {mobileOpen && <div className="fixed inset-0 z-50 overflow-y-auto lg:hidden" role="dialog" aria-modal="true" aria-label={`${selected.display_name ?? selected.external_user_id} details`}><UserDetails supporter={selected} entitlements={selectedEntitlements} events={selectedEvents} mobile onClose={() => setMobileOpen(false)} /></div>}
    </div>
  );
}

function TestConsole({ projectId }: { projectId: string }) {
  const initial: TestEventState = {};
  const [state, action] = useActionState(sendTestDonation, initial);
  return (
    <div className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr]">
      <form action={action} className="space-y-5 rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8">
        <div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-coral-dark"><FlaskConical className="size-4" /> Verified event simulator</p><h2 className="mt-2 text-2xl font-semibold">Test before touching PayPal.</h2><p className="mt-2 text-sm leading-6 text-ink-soft">Creates the same deterministic donation event your server integration would send.</p></div>
        <input type="hidden" name="project_id" value={projectId} />
        <label className="block"><span className="mb-2 block text-sm font-semibold">Shopper ID</span><input name="external_user_id" required defaultValue="mike-shopper-jamie" className="min-h-11 w-full rounded-xl border border-line px-3 font-mono text-sm" /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold">Display name</span><input name="display_name" required defaultValue="Jamie · Mike’s Vegan Shop shopper" className="min-h-11 w-full rounded-xl border border-line px-3" /></label>
        <label className="block"><span className="mb-2 block text-sm font-semibold">Verified donation</span><div className="flex min-h-12 items-center rounded-xl border border-line bg-white px-3"><span>$</span><input name="amount" required inputMode="decimal" defaultValue="50.00" className="min-h-10 flex-1 px-2 outline-none" /><span className="text-xs font-bold text-ink-soft">USD</span></div></label>
        <FormMessage error={state.error} message={state.success} />
        <SubmitButton pendingLabel="Evaluating rules…"><Radio className="size-4" /> Send verified donation event</SubmitButton>
      </form>
      <div className="rounded-[2rem] bg-ink p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-mint">Evaluation result</p>
        <h2 className="mt-2 text-2xl font-semibold">Shopper entitlement state</h2>
        {state.entitlements?.length ? <div className="mt-6 space-y-3">{state.entitlements.map((entitlement) => <div key={entitlement.entitlement_key} className="rounded-2xl bg-white/10 p-4"><div className="flex items-center justify-between gap-3"><code className="text-sm text-mint">{entitlement.entitlement_key}</code><span className={entitlement.state === "active" ? "rounded-full bg-mint/20 px-2.5 py-1 text-xs font-bold text-mint" : "rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/60"}>{entitlement.state}</span></div><p className="mt-2 text-xs text-white/55">Progress: {entitlement.progress_unit === "events" ? entitlement.progress_value : `$${(entitlement.progress_value / 100).toFixed(2)} ${entitlement.progress_unit.toUpperCase()}`}</p></div>)}</div> : <div className="mt-6 rounded-2xl border border-dashed border-white/20 p-6 text-sm leading-6 text-white/55">Send a test donation to see the exact entitlement state returned by the SDK.</div>}
        <pre className="mt-6 overflow-x-auto rounded-2xl bg-black/20 p-4 text-xs leading-6 text-mint">{`const impact = new OurImpact({ publishableKey, userToken });\nconst unlocked = await impact.user.is("generous_gary");`}</pre>
      </div>
    </div>
  );
}

export function DeveloperProjectWorkspace(props: WorkspaceProps) {
  const [tab, setTab] = useState<Tab>("overview");
  const activeEntitlements = props.userEntitlements.filter((item) => item.state === "active").length;
  const activeSecret = props.keys.find((key) => !key.revoked_at) ?? null;
  const rotatedSecrets = props.keys.filter((key) => key.revoked_at);
  const successfulDeliveries = props.deliveries.filter((delivery) => delivery.status === "delivered" || (delivery.response_status !== null && delivery.response_status >= 200 && delivery.response_status < 300)).length;
  const deliveryRate = props.deliveries.length ? `${Math.round((successfulDeliveries / props.deliveries.length) * 100)}%` : "—";
  const apiHealthy = Boolean(activeSecret && props.project.allowed_origins.length);
  return (
    <div className="mt-5">
      <div className="overflow-x-auto border-b border-ink/10">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="Developer project sections">
          {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={tab === item.id ? "flex items-center gap-2 border-b-2 border-mint-dark px-4 py-3 text-sm font-semibold text-ink" : "flex items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-ink-soft hover:text-ink"}><Icon className="size-4" /> {item.label}</button>; })}
        </div>
      </div>

      <div className="mt-7">
        {tab === "overview" && (
          <div className="space-y-7">
            <div className="grid gap-3 sm:grid-cols-3"><Stat icon={Users} value={props.supporters.length} label="known shoppers" /><Stat icon={Radio} value={props.eventCount} label="verified events" /><Stat icon={BadgeCheck} value={activeEntitlements} label="active grants" /></div>
            <div className="grid gap-7 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.15em] text-coral-dark">Integration path</p><h2 className="mt-2 text-2xl font-semibold">From verified support to a product experience.</h2><div className="mt-6 grid gap-3 sm:grid-cols-3">{[{ icon: Radio, title: "1. Verify support", body: "The identified widget records PayPal support, or your server sends an API event." }, { icon: Settings2, title: "2. Evaluate", body: "Our Impact applies your approved earning rules." }, { icon: Sparkles, title: "3. Unlock", body: "Your product queries a stable entitlement key." }].map(({ icon: Icon, title, body }) => <div key={title} className="rounded-2xl bg-paper p-4"><Icon className="size-5 text-coral-dark" /><p className="mt-3 font-semibold">{title}</p><p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p></div>)}</div><button onClick={() => setTab("test")} className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">Open test console <ArrowRight className="size-4" /></button></section>
              <section className="rounded-[2rem] bg-mint/12 p-6 ring-1 ring-mint/25"><Code2 className="size-5 text-mint-dark" /><p className="mt-3 text-sm font-semibold">Browser SDK</p><code className="mt-2 block break-all text-xs text-ink-soft">{props.project.publishable_key}</code><pre className="mt-5 overflow-x-auto rounded-2xl bg-ink p-4 text-xs leading-6 text-mint">{`await impact.user.is(\n  "community_champion_theme"\n);`}</pre><Link href={`/demo/local-shop/${props.project.id}`} target="_blank" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-mint-dark">Open preview site <ExternalLink className="size-4" /></Link></section>
            </div>
          </div>
        )}
        {tab === "entitlements" && <EntitlementsTab props={props} />}
        {tab === "users" && <UsersTab props={props} />}
        {tab === "api" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-coral-dark">Project integration</p><h2 className="display-type mt-1 text-3xl font-semibold sm:text-4xl">API &amp; Webhooks</h2><p className="mt-2 text-sm text-ink-soft">Connect your product, receive signed events, and monitor delivery health.</p></div>
              <div className="flex flex-wrap gap-2"><Link href="/developers/docs" target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink"><BookOpen className="size-4" /> Documentation</Link><a href="/api/openapi" target="_blank" className="inline-flex items-center gap-2 rounded-xl bg-mint-dark px-4 py-2.5 text-sm font-semibold text-white"><Download className="size-4" /> Download OpenAPI</a></div>
            </div>

            <section className="dashboard-card grid overflow-hidden rounded-[1.25rem] sm:grid-cols-2 xl:grid-cols-4" aria-label="API health summary">
              {[{ icon: ShieldCheck, value: apiHealthy ? "Healthy" : "Setup needed", label: "API status" }, { icon: Code2, value: props.project.allowed_origins.length, label: "allowed origins" }, { icon: Webhook, value: props.endpoints.length, label: "webhook endpoints" }, { icon: Activity, value: deliveryRate, label: "recent delivery" }].map(({ icon: Icon, value, label }) => <div key={label} className="flex items-center gap-3 border-b border-ink/8 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><span className="grid size-10 place-items-center rounded-xl bg-mint/14 text-mint-dark"><Icon className="size-5" /></span><div><p className="text-lg font-semibold">{value}</p><p className="text-xs text-ink-soft">{label}</p></div></div>)}
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="dashboard-card rounded-[1.5rem] p-5 sm:p-6">
                <div className="flex items-center gap-2"><Code2 className="size-4 text-mint-dark" /><h3 className="text-xl font-semibold">Client configuration</h3></div>
                <div className="mt-5"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">Browser publishable key</p><span className="rounded-full bg-mint/18 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-mint-dark">Browser safe</span></div><div className="mt-2 flex items-center gap-2 rounded-xl bg-paper px-3 py-2.5"><code className="min-w-0 flex-1 truncate text-xs">{props.project.publishable_key}</code><CopyValueButton value={props.project.publishable_key} /></div><p className="mt-2 text-xs text-ink-soft">Use as <code>OUR_IMPACT_PUBLISHABLE_KEY</code>.</p></div>
                <div className="mt-5 border-t border-line pt-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Allowed origins</p><div className="mt-2 flex flex-wrap gap-2">{props.project.allowed_origins.length ? props.project.allowed_origins.map((origin) => <code key={origin} className="rounded-full bg-mint/14 px-2.5 py-1 text-[11px] text-mint-dark">{origin}</code>) : <span className="text-xs text-ink-soft">No origins configured</span>}</div></div><details className="group w-full sm:w-auto"><summary className="cursor-pointer list-none rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold">Manage origins</summary><div className="mt-3 min-w-0 rounded-2xl bg-paper p-4 sm:w-[24rem]"><AllowedOriginsForm projectId={props.project.id} origins={props.project.allowed_origins} /></div></details></div></div>
              </section>

              <section className="dashboard-card rounded-[1.5rem] p-5 sm:p-6">
                <div className="flex items-center gap-2"><KeyRound className="size-4 text-coral-dark" /><h3 className="text-xl font-semibold">Server credentials</h3></div>
                <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"><div><p className="text-sm font-semibold">Active secret fingerprint</p><div className="mt-2 rounded-xl bg-paper px-3 py-2.5"><code className="text-sm">{activeSecret ? `${activeSecret.key_prefix}••••${activeSecret.last_four}` : "No active secret"}</code></div></div><div><p className="text-sm font-semibold">Last rotated</p><p className="mt-3 text-sm text-ink-soft">{activeSecret ? formatTimestamp(activeSecret.created_at) : "—"}</p></div></div>
                <p className="mt-4 rounded-xl bg-coral/10 px-3 py-2.5 text-xs text-coral-dark">Server secrets are shown only once. Stored values cannot be revealed again.</p>
                <div className="mt-4 flex flex-wrap items-start gap-2"><details className="group"><summary className="cursor-pointer list-none rounded-xl border border-coral/30 bg-white px-3 py-2 text-xs font-semibold text-coral-dark">Rotate secret</summary><div className="mt-3 rounded-2xl bg-paper p-4 sm:w-[24rem]"><RotateKeyForm projectId={props.project.id} /></div></details>{rotatedSecrets.length > 0 && <details className="group"><summary className="cursor-pointer list-none rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-ink-soft">Key history ({rotatedSecrets.length})</summary><div className="mt-3 space-y-2 rounded-2xl bg-paper p-3 sm:w-[20rem]">{rotatedSecrets.map((key) => <div key={key.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2"><code className="truncate text-xs text-ink-soft">{key.key_prefix}…{key.last_four}</code><span className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-soft">Revoked</span></div>)}</div></details>}</div>
              </section>
            </div>

            <section className="dashboard-card rounded-[1.5rem] p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-semibold">Webhook endpoints</h3><p className="mt-1 text-sm text-ink-soft">Signed donation and entitlement events delivered to your servers.</p></div><details className="group"><summary className="cursor-pointer list-none rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white">+ Add endpoint</summary><div className="mt-3 rounded-2xl bg-paper p-4 sm:w-[28rem]"><WebhookForm projectId={props.project.id} /></div></details></div>
              {props.endpoints.length ? <div className="mt-5 overflow-x-auto"><div className="min-w-[580px]">{props.endpoints.map((endpoint) => <div key={endpoint.id} className="grid grid-cols-[minmax(0,1.4fr)_0.6fr_0.45fr] items-center gap-4 border-t border-ink/8 px-2 py-3 first:border-t-0"><div><p className="truncate text-sm font-semibold">{endpoint.description || "Webhook endpoint"}</p><code className="mt-1 block truncate text-xs text-ink-soft">{endpoint.url}</code></div><span className="text-xs text-ink-soft">All events</span><span className={endpoint.state === "active" ? "w-fit rounded-full bg-mint/18 px-2.5 py-1 text-[11px] font-bold text-mint-dark" : "w-fit rounded-full bg-sun/25 px-2.5 py-1 text-[11px] font-bold text-ink"}>{endpoint.state}</span></div>)}</div></div> : <p className="py-6 text-center text-sm text-ink-soft">No webhook endpoints configured.</p>}
            </section>

            <section className="dashboard-card rounded-[1.5rem] p-5 sm:p-6">
              <h3 className="text-xl font-semibold">Recent deliveries</h3>
              {props.deliveries.length ? <div className="mt-4 overflow-x-auto"><div className="min-w-[560px]">{props.deliveries.slice(0, 8).map((delivery) => <div key={delivery.id} className="grid grid-cols-[0.45fr_minmax(0,1fr)_0.45fr_0.75fr] items-center gap-4 border-t border-ink/8 px-2 py-2.5 first:border-t-0"><span className={delivery.response_status && delivery.response_status >= 200 && delivery.response_status < 300 ? "w-fit rounded-full bg-mint/18 px-2.5 py-1 text-[11px] font-bold text-mint-dark" : "w-fit rounded-full bg-sun/25 px-2.5 py-1 text-[11px] font-bold text-ink"}>{delivery.response_status ?? delivery.status}</span><code className="truncate text-xs text-ink-soft">{delivery.event_type}</code><span className="text-xs text-ink-soft">{delivery.status}</span><time className="text-right text-xs text-ink-soft">{formatTimestamp(delivery.created_at)}</time></div>)}</div></div> : <p className="py-6 text-center text-sm text-ink-soft">No webhook deliveries yet.</p>}
            </section>
          </div>
        )}
        {tab === "test" && <TestConsole projectId={props.project.id} />}
      </div>
    </div>
  );
}
