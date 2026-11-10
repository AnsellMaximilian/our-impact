"use client";

import {
  useActionState,
  useEffect,
  useOptimistic,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  CalendarDays,
  Check,
  Coins,
  LoaderCircle,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import {
  applyCampaignAssistantProposal,
  askCampaignAssistant,
  type CampaignAssistantApplyState,
  type CampaignAssistantState,
} from "@/app/dashboard/campaigns/new/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { CampaignProposal } from "@/lib/ai/campaign-assistant";
import type { TableRow } from "@/lib/database.types";
import { formatMoney } from "@/lib/money";

type Organization = Pick<
  TableRow<"organizations">,
  "id" | "name" | "category" | "short_description"
>;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: NonNullable<CampaignAssistantState["response"]>;
};

function conversationContent(message: ChatMessage) {
  const proposal = message.response?.proposal;
  if (!proposal) return message.content;
  const draftValues = {
    title: proposal.title,
    summary: proposal.summary,
    budget_minor: proposal.budget_minor,
    currency: proposal.currency,
    organization_ids: proposal.organization_ids,
    period_cadence: proposal.period_cadence,
    timezone: proposal.timezone,
    close_local_time: proposal.close_local_time,
    close_weekday: proposal.close_weekday,
    allocation_model: proposal.allocation_model,
  };
  return `${message.content}\nCurrent suggested draft: ${JSON.stringify(draftValues)}`.slice(0, 4000);
}

const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const allocationLabels = {
  proportional: "Proportional to votes",
  winner_takes_all: "Winner takes all",
  hybrid: "Hybrid base + proportional",
} as const;

function CampaignProposalPreview({
  proposal,
  organizations,
  responseId,
  applyingResponseId,
  applyState,
  applyAction,
  onApply,
}: {
  proposal: CampaignProposal;
  organizations: Organization[];
  responseId: string;
  applyingResponseId: string | null;
  applyState: CampaignAssistantApplyState;
  applyAction: (payload: FormData) => void;
  onApply: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const selectedOrganizations = organizations.filter((organization) =>
    proposal.organization_ids.includes(organization.id),
  );
  const roundDescription = proposal.period_cadence === "weekly"
    ? `Every ${weekdays[proposal.close_weekday]} at ${proposal.close_local_time}`
    : `Every day at ${proposal.close_local_time}`;
  const cards = [
    {
      label: "Story",
      title: proposal.title,
      icon: Sparkles,
      body: (
        <>
          <p className="text-sm leading-6 text-ink-soft">{proposal.summary}</p>
          <p className="mt-4 rounded-xl bg-paper px-3 py-2.5 text-xs leading-5 text-ink-soft">
            {proposal.step_notes.story}
          </p>
        </>
      ),
    },
    {
      label: "Commitment",
      title: formatMoney(proposal.budget_minor, proposal.currency),
      icon: Coins,
      body: (
        <>
          <p className="text-sm text-ink-soft">Maximum business commitment in every voting round.</p>
          <p className="mt-4 rounded-xl bg-paper px-3 py-2.5 text-xs leading-5 text-ink-soft">
            {proposal.step_notes.commitment}
          </p>
        </>
      ),
    },
    {
      label: "Recipients",
      title: `${selectedOrganizations.length} voting choices`,
      icon: Building2,
      body: (
        <>
          <div className="flex flex-wrap gap-2">
            {selectedOrganizations.map((organization) => (
              <span key={organization.id} className="rounded-full bg-mint/15 px-3 py-1.5 text-xs font-semibold text-mint-dark">
                {organization.name}
              </span>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-paper px-3 py-2.5 text-xs leading-5 text-ink-soft">
            {proposal.step_notes.recipients}
          </p>
        </>
      ),
    },
    {
      label: "Voting rounds",
      title: proposal.period_cadence === "weekly" ? "Weekly voting" : "Daily voting",
      icon: CalendarDays,
      body: (
        <>
          <p className="text-sm font-semibold text-ink">{roundDescription}</p>
          <p className="mt-1 text-xs text-ink-soft">{proposal.timezone}</p>
          <p className="mt-4 rounded-xl bg-paper px-3 py-2.5 text-xs leading-5 text-ink-soft">
            {proposal.step_notes.rounds}
          </p>
        </>
      ),
    },
    {
      label: "Allocation",
      title: allocationLabels[proposal.allocation_model],
      icon: Users,
      body: (
        <>
          <p className="text-sm leading-6 text-ink-soft">
            The final vote count creates a payment plan for the owner to review. It never charges automatically.
          </p>
          <p className="mt-4 rounded-xl bg-paper px-3 py-2.5 text-xs leading-5 text-ink-soft">
            {proposal.step_notes.allocation}
          </p>
        </>
      ),
    },
  ];
  const card = cards[currentStep];
  const Icon = card.icon;
  const showApplyState = applyingResponseId === responseId;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl bg-white text-ink shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-coral-dark">Campaign preview</p>
          <p className="mt-0.5 text-xs font-semibold text-ink-soft">Step {currentStep + 1} of {cards.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
            disabled={currentStep === 0}
            aria-label="Previous campaign detail"
            className="grid size-9 place-items-center rounded-xl border border-line bg-white text-ink transition hover:bg-paper disabled:opacity-35"
          >
            <ArrowLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentStep((step) => Math.min(cards.length - 1, step + 1))}
            disabled={currentStep === cards.length - 1}
            aria-label="Next campaign detail"
            className="grid size-9 place-items-center rounded-xl border border-line bg-white text-ink transition hover:bg-paper disabled:opacity-35"
          >
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="min-h-60 p-5">
        <span className="grid size-10 place-items-center rounded-xl bg-mint/15 text-mint-dark">
          <Icon className="size-5" />
        </span>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.13em] text-ink-soft">{card.label}</p>
        <h3 className="mt-1 text-xl font-semibold">{card.title}</h3>
        <div className="mt-3">{card.body}</div>
      </div>

      <div className="flex items-center justify-center gap-1.5 border-t border-line px-4 py-3" aria-label="Campaign preview steps">
        {cards.map((step, index) => (
          <button
            key={step.label}
            type="button"
            onClick={() => setCurrentStep(index)}
            aria-label={`Show ${step.label}`}
            aria-current={index === currentStep ? "step" : undefined}
            className={index === currentStep ? "h-2 w-6 rounded-full bg-mint-dark" : "size-2 rounded-full bg-ink/15"}
          />
        ))}
      </div>

      <form action={applyAction} onSubmit={onApply} className="border-t border-line p-4">
        <input type="hidden" name="proposal" value={JSON.stringify(proposal)} />
        {showApplyState && <FormMessage error={applyState.error} />}
        <p className="mb-3 text-xs leading-5 text-ink-soft">
          Approval creates a private draft. You can edit every field before publishing or funding it.
        </p>
        <SubmitButton pendingLabel="Creating private draft…" className="w-full rounded-xl bg-mint-dark text-white">
          <Check className="size-4" /> Create this private draft
        </SubmitButton>
      </form>
    </div>
  );
}

export function CampaignAssistant({
  organizations,
  ready,
  model,
}: {
  organizations: Organization[];
  ready: boolean;
  model: string | null;
}) {
  const initialAssistant: CampaignAssistantState = {};
  const initialApply: CampaignAssistantApplyState = {};
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (current, message: ChatMessage) => [...current, message],
  );
  const [assistantState, assistantAction, assistantPending] = useActionState(
    askCampaignAssistant,
    initialAssistant,
  );
  const [applyState, applyAction] = useActionState(
    applyCampaignAssistantProposal,
    initialApply,
  );
  const [applyingResponseId, setApplyingResponseId] = useState<string | null>(null);
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
        }
      : {
          id: `assistant-${responseKey}`,
          role: "assistant",
          content: `${assistantState.error} Please check the request and try again; no campaign was created.`,
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
  }, [optimisticMessages.length, assistantPending, applyState.error]);

  function submit(formData: FormData) {
    const message = String(formData.get("message") ?? "").trim();
    if (!message) return;
    formData.set(
      "history",
      JSON.stringify(messages.slice(-8).map((message) => ({
        role: message.role,
        content: conversationContent(message),
      }))),
    );
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
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-mint">
            <Sparkles className="size-4" /> Campaign assistant
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Tell me what you want your community to celebrate.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
            I’ll compare your idea with connected recipient partners and suggest a complete private draft for you to review.
          </p>
        </div>
        <span className="w-fit shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/70">
          {ready ? model ?? "OpenRouter ready" : "Setup required"}
        </span>
      </div>

      <div ref={threadRef} className="assistant-scrollbar max-h-[38rem] min-h-72 space-y-4 overflow-y-auto p-6" aria-live="polite">
        {!optimisticMessages.length && !assistantPending && (
          <div className="rounded-2xl bg-white/8 p-4 text-sm leading-6 text-white/75">
            <p className="font-semibold text-white">Try your campaign idea</p>
            <p className="mt-1">“I’m celebrating my vegan shop’s first anniversary. I’d like to give back to animal welfare and organic gardens.”</p>
          </div>
        )}

        {optimisticMessages.map((message) => {
          if (message.role === "user") {
            return (
              <div key={message.id} className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-coral px-4 py-3 text-sm text-white shadow-sm">
                {message.content}
              </div>
            );
          }

          const proposal = message.response?.proposal ?? null;
          return (
            <div key={message.id} className="max-w-[96%] rounded-2xl rounded-bl-md bg-white/10 p-4 text-sm leading-6 text-white/85">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-mint/15 text-mint">
                  <Bot className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {proposal && (
                    <CampaignProposalPreview
                      proposal={proposal}
                      organizations={organizations}
                      responseId={message.id}
                      applyingResponseId={applyingResponseId}
                      applyState={applyState}
                      applyAction={applyAction}
                      onApply={() => setApplyingResponseId(message.id)}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {assistantPending && (
          <div className="max-w-[96%] rounded-2xl rounded-bl-md bg-white/10 px-4 py-3 text-sm text-white/70">
            <div className="flex items-center gap-3">
              <span className="grid size-7 place-items-center rounded-full bg-mint/15 text-mint">
                <LoaderCircle className="size-4 animate-spin" />
              </span>
              <span>Comparing your idea with the recipient network and campaign settings…</span>
            </div>
          </div>
        )}
      </div>

      <form ref={formRef} action={submit} className="border-t border-white/10 p-4 sm:p-5">
        <input type="hidden" name="history" value="[]" />
        <div className="flex items-end gap-3 rounded-2xl bg-white p-2 text-ink">
          <textarea
            name="message"
            required
            minLength={2}
            maxLength={2000}
            rows={2}
            disabled={!ready || assistantPending}
            placeholder={ready
              ? "Describe an occasion, cause, budget, or ask for suggestions…"
              : "Add the OpenRouter environment variables to use the assistant."}
            className="min-h-12 max-h-32 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-5 outline-none"
          />
          <button
            disabled={!ready || assistantPending}
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-coral text-white transition hover:bg-coral-dark disabled:opacity-40"
            aria-label="Send campaign request"
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </section>
  );
}
