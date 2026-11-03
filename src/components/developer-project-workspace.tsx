"use client";

import { useActionState, useEffect, useOptimistic, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
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
  KeyRound,
  LoaderCircle,
  Plus,
  Radio,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Webhook,
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
import { RotateKeyForm, WebhookForm } from "@/components/developer-forms";
import { FormMessage } from "@/components/form-message";
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
  last_seen_at: string;
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
  keys: Array<{
    id: string;
    key_prefix: string;
    last_four: string;
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
    <details className="group rounded-3xl border border-dashed border-ink/20 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold">
        <span className="flex items-center gap-2"><Plus className="size-4 text-coral-dark" /> Create entitlement manually</span>
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
      </summary>
      <form action={action} className="space-y-5 border-t border-line p-5">
        <input type="hidden" name="project_id" value={projectId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-2 block text-sm font-semibold">Display name</span>
            <input name="name" required defaultValue="Generous Gary" className="min-h-11 w-full rounded-xl border border-line px-3" />
          </label>
          <label>
            <span className="mb-2 block text-sm font-semibold">SDK key</span>
            <input name="entitlement_key" required pattern="[a-z][a-z0-9_]{1,79}" defaultValue="generous_gary" className="min-h-11 w-full rounded-xl border border-line px-3 font-mono text-sm" />
          </label>
          <label className="sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold">What this unlocks</span>
            <textarea name="description" maxLength={280} rows={2} defaultValue="Unlocks Mike’s community champion theme." className="w-full rounded-xl border border-line px-3 py-2" />
          </label>
        </div>
        <RuleFields />
        <FormMessage error={state.error} message={state.success} />
        <SubmitButton pendingLabel="Creating…">Create entitlement</SubmitButton>
      </form>
    </details>
  );
}

function AddRuleForm({ projectId, definition }: { projectId: string; definition: Definition }) {
  const initial: EntitlementStudioState = {};
  const [state, action] = useActionState(addEntitlementRule, initial);
  return (
    <details className="group mt-4 rounded-2xl border border-line bg-white/70">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2"><Plus className="size-3.5" /> Add another earning path</span>
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
      </summary>
      <form action={action} className="space-y-4 border-t border-line p-4">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="entitlement_id" value={definition.id} />
        <RuleFields />
        <FormMessage error={state.error} message={state.success} />
        <SubmitButton pendingLabel="Adding…">Add earning path</SubmitButton>
      </form>
    </details>
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
  return (
    <div className="space-y-7">
      <AssistantPanel projectId={props.project.id} definitions={props.definitions} ready={props.openRouterReady} model={props.openRouterModel} />
      <div className="grid gap-7 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-coral-dark">Entitlement catalog</p><h2 className="mt-2 text-2xl font-semibold">Benefits your product can query</h2><p className="mt-2 text-sm text-ink-soft">Each stable SDK key can have multiple earning paths. A shopper qualifies when any active path is satisfied.</p></div>
          {props.definitions.map((definition) => {
            const rules = props.rules.filter((rule) => rule.entitlement_id === definition.id);
            const activeUsers = props.userEntitlements.filter((item) => item.entitlement_key === definition.entitlement_key && item.state === "active").length;
            return (
              <article key={definition.id} className="rounded-3xl bg-surface p-5 ring-1 ring-ink/8 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-semibold">{definition.name}</h3><span className={definition.state === "active" ? "rounded-full bg-mint/15 px-2.5 py-1 text-xs font-bold text-mint-dark" : "rounded-full bg-ink/8 px-2.5 py-1 text-xs font-bold text-ink-soft"}>{definition.state}</span></div><code className="mt-2 block text-xs text-ink-soft">{definition.entitlement_key}</code><p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">{definition.description || "No customer-facing description yet."}</p></div>
                  <div className="flex items-center gap-2"><span className="rounded-xl bg-paper px-3 py-2 text-xs font-semibold text-ink-soft">{activeUsers} active user{activeUsers === 1 ? "" : "s"}</span><form action={setEntitlementState}><input type="hidden" name="project_id" value={props.project.id} /><input type="hidden" name="entitlement_id" value={definition.id} /><input type="hidden" name="state" value={definition.state === "active" ? "disabled" : "active"} /><button className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold hover:bg-paper">{definition.state === "active" ? "Disable" : "Enable"}</button></form></div>
                </div>
                <div className="mt-5 space-y-2">
                  {rules.map((rule, index) => <div key={rule.id} className="flex items-start gap-3 rounded-2xl bg-paper px-4 py-3"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-coral-dark ring-1 ring-ink/8">{index + 1}</span><div><p className="text-sm font-semibold">{rule.name}</p><p className="mt-1 text-xs text-ink-soft">{ruleSummary(rule)}</p></div></div>)}
                </div>
                <AddRuleForm projectId={props.project.id} definition={definition} />
              </article>
            );
          })}
          {!props.definitions.length && <div className="rounded-3xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink-soft">No entitlements yet. Ask the assistant or create one manually.</div>}
        </div>
        <div className="space-y-4">
          <NewEntitlementForm projectId={props.project.id} />
          <div className="rounded-3xl bg-mint/12 p-5 ring-1 ring-mint/25"><ShieldCheck className="size-5 text-mint-dark" /><p className="mt-3 font-semibold">AI proposes. Your rules decide.</p><p className="mt-2 text-sm leading-6 text-ink-soft">The model never grants a shopper a benefit. It only prepares a validated rule that an owner or admin must approve.</p></div>
        </div>
      </div>
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
  return (
    <div className="mt-8">
      <div className="overflow-x-auto pb-2">
        <div className="flex min-w-max gap-1 rounded-2xl bg-ink/5 p-1.5" role="tablist" aria-label="Developer project sections">
          {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={tab === item.id ? "flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-ink shadow-sm" : "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-soft hover:text-ink"}><Icon className="size-4" /> {item.label}</button>; })}
        </div>
      </div>

      <div className="mt-7">
        {tab === "overview" && (
          <div className="space-y-7">
            <div className="grid gap-3 sm:grid-cols-3"><Stat icon={Users} value={props.supporters.length} label="known shoppers" /><Stat icon={Radio} value={props.eventCount} label="verified events" /><Stat icon={BadgeCheck} value={activeEntitlements} label="active grants" /></div>
            <div className="grid gap-7 lg:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.15em] text-coral-dark">Integration path</p><h2 className="mt-2 text-2xl font-semibold">From verified support to a product experience.</h2><div className="mt-6 grid gap-3 sm:grid-cols-3">{[{ icon: Radio, title: "1. Send event", body: "Mike’s server forwards a verified donation." }, { icon: Settings2, title: "2. Evaluate", body: "Our Impact applies the approved earning rules." }, { icon: Sparkles, title: "3. Unlock", body: "Mike’s site queries a stable entitlement key." }].map(({ icon: Icon, title, body }) => <div key={title} className="rounded-2xl bg-paper p-4"><Icon className="size-5 text-coral-dark" /><p className="mt-3 font-semibold">{title}</p><p className="mt-2 text-sm leading-6 text-ink-soft">{body}</p></div>)}</div><button onClick={() => setTab("test")} className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">Run a safe test <ArrowRight className="size-4" /></button></section>
              <section className="rounded-[2rem] bg-mint/12 p-6 ring-1 ring-mint/25"><Code2 className="size-5 text-mint-dark" /><p className="mt-3 text-sm font-semibold">Browser SDK</p><code className="mt-2 block break-all text-xs text-ink-soft">{props.project.publishable_key}</code><pre className="mt-5 overflow-x-auto rounded-2xl bg-ink p-4 text-xs leading-6 text-mint">{`await impact.user.is(\n  "community_champion_theme"\n);`}</pre><Link href={`/demo/local-shop/${props.project.id}`} target="_blank" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-mint-dark">Open Mike’s test shop <ExternalLink className="size-4" /></Link></section>
            </div>
          </div>
        )}
        {tab === "entitlements" && <EntitlementsTab props={props} />}
        {tab === "users" && (
          <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-coral-dark">Customer identity</p><h2 className="mt-2 text-2xl font-semibold">Known shoppers and their product state</h2><p className="mt-2 text-sm text-ink-soft">Our Impact stores Mike’s external user IDs—not shopper passwords.</p></div><div className="mt-6 divide-y divide-line">{props.supporters.map((supporter) => { const roles = props.userEntitlements.filter((item) => item.supporter_id === supporter.id && item.state === "active"); return <div key={supporter.id} className="grid gap-3 py-5 sm:grid-cols-[1fr_1.3fr] sm:items-center"><div><p className="font-semibold">{supporter.display_name ?? supporter.external_user_id}</p><code className="mt-1 block text-xs text-ink-soft">{supporter.external_user_id}</code></div><div className="flex flex-wrap gap-2">{roles.length ? roles.map((role) => <span key={role.id} className="rounded-full bg-mint/15 px-3 py-1.5 text-xs font-semibold text-mint-dark">{role.entitlement_key}</span>) : <span className="text-sm text-ink-soft">No active entitlements</span>}</div></div>; })}{!props.supporters.length && <p className="py-8 text-center text-sm text-ink-soft">No identified shoppers yet. Use the Test console to create one.</p>}</div></section>
        )}
        {tab === "api" && (
          <div className="space-y-7">
            <section className="flex flex-col gap-5 rounded-[2rem] bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-mint"><BookOpen className="size-4" /> Versioned API contract</p>
                <h2 className="mt-2 text-2xl font-semibold">Build against the docs or import the OpenAPI file.</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">The same contract powers the Mike’s Vegan Shop demo and is ready to evaluate in APIMatic without committing the product to generated code.</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link href="/developers/docs" target="_blank" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-ink"><BookOpen className="size-4" /> Quickstart</Link>
                <a href="/api/openapi" target="_blank" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15"><Download className="size-4" /> OpenAPI</a>
              </div>
            </section>
            <div className="grid gap-7 lg:grid-cols-2">
              <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8">
                <p className="flex items-center gap-2 font-semibold"><KeyRound className="size-4" /> API credentials</p>
                <p className="mt-2 text-sm text-ink-soft">Publishable keys identify the project. Server secrets authenticate verified events.</p>
                <code className="mt-5 block break-all rounded-xl bg-paper p-3 text-xs">{props.project.publishable_key}</code>
                <div className="my-4 space-y-2">{props.keys.map((key) => <p key={key.id} className="font-mono text-xs text-ink-soft">{key.key_prefix}…{key.last_four} · {key.revoked_at ? "revoked" : "active"}</p>)}</div>
                <RotateKeyForm projectId={props.project.id} />
                <div className="mt-6"><p className="text-sm font-semibold">Allowed browser origins</p><div className="mt-2 flex flex-wrap gap-2">{props.project.allowed_origins.map((origin) => <code key={origin} className="rounded-full bg-paper px-3 py-1.5 text-xs">{origin}</code>)}</div></div>
              </section>
              <section className="space-y-5">
                <WebhookForm projectId={props.project.id} />
                {props.endpoints.map((endpoint) => <div key={endpoint.id} className="rounded-2xl bg-surface p-5 ring-1 ring-ink/8"><p className="flex items-center gap-2 font-semibold"><Webhook className="size-4" /> {endpoint.description || "Webhook endpoint"}</p><p className="mt-2 break-all text-xs text-ink-soft">{endpoint.url}</p><span className="mt-3 inline-block rounded-full bg-mint/15 px-2.5 py-1 text-xs font-bold text-mint-dark">{endpoint.state}</span></div>)}
                {!!props.deliveries.length && <div className="rounded-2xl bg-surface p-5 ring-1 ring-ink/8"><p className="font-semibold">Recent delivery health</p>{props.deliveries.slice(0, 6).map((delivery) => <p key={delivery.id} className="mt-2 text-xs text-ink-soft">{delivery.event_type} · {delivery.status}{delivery.response_status ? ` · HTTP ${delivery.response_status}` : ""}</p>)}</div>}
              </section>
            </div>
          </div>
        )}
        {tab === "test" && <TestConsole projectId={props.project.id} />}
      </div>
    </div>
  );
}
