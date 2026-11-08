"use client";

import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Coins,
  Sparkles,
  Users,
} from "lucide-react";
import {
  createDraftCampaign,
  type DashboardActionState,
  updateDraftCampaign,
} from "@/app/dashboard/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { TableRow } from "@/lib/database.types";
import { minorUnitsToMoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";

const initialState: DashboardActionState = {};
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const steps = [
  { label: "Basics", title: "Introduce your campaign" },
  { label: "Commitment", title: "Set your commitment" },
  { label: "Recipients", title: "Choose recipient partners" },
  { label: "Rules", title: "Shape each voting round" },
  { label: "Review", title: "Review your campaign" },
] as const;

const allocationOptions = [
  {
    value: "proportional",
    title: "Proportional to votes",
    description: "Divide the commitment according to each recipient’s share of valid votes.",
    bestFor: "Best when every vote should influence the final split.",
  },
  {
    value: "winner_takes_all",
    title: "Winner takes all",
    description: "Direct the full commitment to the recipient with the most valid votes.",
    bestFor: "Best for a clear community choice each round.",
  },
  {
    value: "hybrid",
    title: "Hybrid base + proportional",
    description: "Give every recipient a base share, then divide the remainder by vote share.",
    bestFor: "Best when everyone should benefit while votes still matter.",
  },
] as const;

type CampaignFormValues = {
  title: string;
  summary: string;
  amount: string;
  currency: "EUR" | "IDR" | "USD";
  organizationIds: number[];
  periodCadence: "daily" | "weekly";
  timezone: string;
  closeLocalTime: string;
  closeWeekday: string;
  allocationModel: "winner_takes_all" | "proportional" | "hybrid";
};

function formatAmount(amount: string, currency: CampaignFormValues["currency"]) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Not set";

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "IDR" ? 0 : 2,
  }).format(parsed);
}

export function CampaignForm({
  organizations,
  campaign,
  selectedOrganizationIds = [],
}: {
  organizations: TableRow<"organizations">[];
  campaign?: TableRow<"campaigns">;
  selectedOrganizationIds?: number[];
}) {
  const isEditing = Boolean(campaign);
  const [state, action] = useActionState(
    isEditing ? updateDraftCampaign : createDraftCampaign,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);
  const [stepError, setStepError] = useState<string>();
  const [values, setValues] = useState<CampaignFormValues>(() => ({
    title: campaign?.title ?? "",
    summary: campaign?.summary ?? "",
    amount: campaign
      ? minorUnitsToMoneyInput(campaign.budget_minor, campaign.currency)
      : "",
    currency: (campaign?.currency as CampaignFormValues["currency"]) ?? "USD",
    organizationIds: selectedOrganizationIds,
    periodCadence:
      (campaign?.period_cadence as CampaignFormValues["periodCadence"]) ?? "weekly",
    timezone: campaign?.timezone ?? "Asia/Jakarta",
    closeLocalTime: campaign?.close_local_time?.slice(0, 5) ?? "20:00",
    closeWeekday: String(campaign?.close_weekday ?? 5),
    allocationModel:
      (campaign?.allocation_model as CampaignFormValues["allocationModel"]) ??
      "proportional",
  }));

  const selectedOrganizations = useMemo(
    () => organizations.filter((organization) => values.organizationIds.includes(organization.id)),
    [organizations, values.organizationIds],
  );
  const selectedAllocation =
    allocationOptions.find((option) => option.value === values.allocationModel) ??
    allocationOptions[0];

  function updateValue<Key extends keyof CampaignFormValues>(
    key: Key,
    value: CampaignFormValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setStepError(undefined);
  }

  function validateStep(step: number) {
    if (step === 1) {
      if (values.title.trim().length < 3) return "Give the campaign a title of at least 3 characters.";
      if (values.title.trim().length > 120) return "Keep the campaign title under 120 characters.";
      if (values.summary.trim().length < 20) return "Add a little more context for visitors.";
      if (values.summary.trim().length > 280) return "Keep the explanation under 280 characters.";
    }

    if (step === 2) {
      const amount = Number(values.amount);
      if (!values.amount.trim() || !Number.isFinite(amount) || amount <= 0) {
        return "Enter a commitment greater than zero.";
      }
    }

    if (step === 3) {
      if (values.organizationIds.length < 2) return "Choose at least two recipient partners.";
      if (values.organizationIds.length > 5) return "Choose no more than five recipient partners.";
    }

    if (step === 4) {
      if (!values.closeLocalTime) return "Choose when each voting round should close.";
      if (!values.timezone) return "Choose the time zone used for campaign rounds.";
    }

    return undefined;
  }

  function focusStep(step: number) {
    window.requestAnimationFrame(() => {
      formRef.current
        ?.querySelector<HTMLElement>(`[data-step-heading="${step}"]`)
        ?.focus({ preventScroll: true });
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function goToStep(step: number) {
    setCurrentStep(step);
    setStepError(undefined);
    focusStep(step);
  }

  function continueToNextStep() {
    const error = validateStep(currentStep);
    if (error) {
      setStepError(error);
      return;
    }

    const nextStep = Math.min(currentStep + 1, steps.length);
    setFurthestStep((current) => Math.max(current, nextStep));
    goToStep(nextStep);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    for (let step = 1; step < steps.length; step += 1) {
      const error = validateStep(step);
      if (error) {
        event.preventDefault();
        setCurrentStep(step);
        setStepError(error);
        focusStep(step);
        return;
      }
    }
  }

  return (
    <form ref={formRef} action={action} noValidate onSubmit={handleSubmit} className="space-y-6">
      {campaign && <input type="hidden" name="campaign_id" value={campaign.id} />}

      <div className="rounded-[1.75rem] bg-surface p-5 ring-1 ring-ink/8 sm:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint-dark">
              Step {currentStep} of {steps.length}
            </p>
            <p className="mt-1 text-lg font-semibold">{steps[currentStep - 1].title}</p>
          </div>
          <span className="text-sm font-semibold text-ink-soft">
            {Math.round((currentStep / steps.length) * 100)}%
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink/8" aria-hidden="true">
          <div
            className="h-full rounded-full bg-mint-dark transition-[width] duration-300"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
        <ol className="mt-5 grid grid-cols-5 gap-2" aria-label="Campaign setup progress">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isComplete = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            const canVisit = stepNumber <= furthestStep;

            return (
              <li key={step.label}>
                <button
                  type="button"
                  disabled={!canVisit}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => goToStep(stepNumber)}
                  className={cn(
                    "flex w-full flex-col items-center gap-2 rounded-xl px-1 py-2 text-center text-xs font-semibold transition sm:flex-row sm:justify-center sm:text-sm",
                    isCurrent && "bg-mint/18 text-mint-dark",
                    isComplete && "text-mint-dark hover:bg-mint/10",
                    !isCurrent && !isComplete && "text-ink-soft",
                    !canVisit && "cursor-not-allowed opacity-45",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full border text-xs",
                      (isCurrent || isComplete) && "border-mint-dark bg-mint-dark text-white",
                      !isCurrent && !isComplete && "border-ink/15 bg-white",
                    )}
                  >
                    {isComplete ? <Check className="size-3.5" aria-hidden="true" /> : stepNumber}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <section
        hidden={currentStep !== 1}
        aria-labelledby="campaign-step-1"
        className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8"
      >
        <div className="mb-7 flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mint/25 text-mint-dark">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="campaign-step-1" data-step-heading="1" tabIndex={-1} className="text-2xl font-semibold outline-none">
              Give the campaign a clear story
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-ink-soft">
              This is the first thing customers will see in your widget. Keep it specific,
              local, and easy to understand.
            </p>
          </div>
        </div>

        <div className="grid gap-5">
          <label className="block">
            <span className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold">
              Campaign title
              <span className="font-normal text-ink-soft">{values.title.length}/120</span>
            </span>
            <input
              name="title"
              required
              minLength={3}
              maxLength={120}
              autoFocus={!campaign}
              placeholder="A brighter neighborhood, chosen together"
              value={values.title}
              onChange={(event) => updateValue("title", event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base outline-none transition focus:border-mint-dark focus:ring-4 focus:ring-mint/15"
            />
          </label>

          <label className="block">
            <span className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold">
              Short explanation
              <span className="font-normal text-ink-soft">{values.summary.length}/280</span>
            </span>
            <textarea
              name="summary"
              required
              minLength={20}
              maxLength={280}
              rows={4}
              placeholder="Tell customers what you are committing and why their voice matters."
              value={values.summary}
              onChange={(event) => updateValue("summary", event.target.value)}
              className="w-full resize-y rounded-2xl border border-line bg-white px-4 py-3 text-base leading-7 outline-none transition focus:border-mint-dark focus:ring-4 focus:ring-mint/15"
            />
          </label>
        </div>
      </section>

      <section
        hidden={currentStep !== 2}
        aria-labelledby="campaign-step-2"
        className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8"
      >
        <div className="mb-7 flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sun/30 text-ink">
            <Coins className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="campaign-step-2" data-step-heading="2" tabIndex={-1} className="text-2xl font-semibold outline-none">
              Decide what your business will commit
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-ink-soft">
              Set the maximum amount available in each voting round. You will review and
              approve payments after the community has voted.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Commitment per round</span>
            <input
              name="amount"
              inputMode="decimal"
              required
              placeholder="100.00"
              value={values.amount}
              onChange={(event) => updateValue("amount", event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base outline-none transition focus:border-mint-dark focus:ring-4 focus:ring-mint/15"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Currency</span>
            <select
              name="currency"
              value={values.currency}
              onChange={(event) =>
                updateValue("currency", event.target.value as CampaignFormValues["currency"])
              }
              className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base outline-none transition focus:border-mint-dark focus:ring-4 focus:ring-mint/15"
            >
              <option value="USD">USD</option>
              <option value="IDR">IDR</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
        </div>

        <div className="mt-6 rounded-2xl bg-paper p-5 ring-1 ring-ink/8">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-ink-soft">Your commitment</p>
          <p className="mt-2 text-3xl font-semibold">{formatAmount(values.amount, values.currency)}</p>
          <p className="mt-1 text-sm text-ink-soft">available in every campaign round</p>
        </div>
      </section>

      <section
        hidden={currentStep !== 3}
        aria-labelledby="campaign-step-3"
        className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8"
      >
        <div className="mb-7 flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-coral/15 text-coral-dark">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="campaign-step-3" data-step-heading="3" tabIndex={-1} className="text-2xl font-semibold outline-none">
                Choose 2–5 recipient partners
              </h2>
              <span className="rounded-full bg-ink/5 px-3 py-1.5 text-sm font-semibold text-ink-soft">
                {values.organizationIds.length} selected
              </span>
            </div>
            <p className="mt-2 max-w-2xl leading-7 text-ink-soft">
              These are the organizations customers can vote for and support through this campaign.
            </p>
          </div>
        </div>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Organizations in this campaign</legend>
          {organizations.map((organization) => {
            const isSelected = values.organizationIds.includes(organization.id);

            return (
              <label
                key={organization.id}
                className="group flex cursor-pointer gap-4 rounded-2xl border border-line bg-white p-4 transition hover:border-mint-dark/35 hover:shadow-sm has-[:checked]:border-mint-dark has-[:checked]:bg-mint/10"
              >
                <input
                  type="checkbox"
                  name="organization_ids"
                  value={organization.id}
                  checked={isSelected}
                  onChange={(event) => {
                    const nextIds = event.target.checked
                      ? [...values.organizationIds, organization.id]
                      : values.organizationIds.filter((id) => id !== organization.id);
                    updateValue("organizationIds", nextIds);
                  }}
                  className="mt-1 size-4 accent-[#1f725d]"
                />
                <span>
                  <span className="block font-semibold">{organization.name}</span>
                  <span className="mt-1 block text-sm leading-6 text-ink-soft">
                    {organization.short_description}
                  </span>
                  <span className="mt-2 inline-block rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold text-ink-soft">
                    {organization.category}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      </section>

      <section
        hidden={currentStep !== 4}
        aria-labelledby="campaign-step-4"
        className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8"
      >
        <div className="mb-7 flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-ink/8 text-ink">
            <CalendarDays className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="campaign-step-4" data-step-heading="4" tabIndex={-1} className="text-2xl font-semibold outline-none">
              Set the rhythm and allocation
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-ink-soft">
              Choose when votes reset and how the commitment is divided when each round closes.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Voting round</span>
            <select
              name="period_cadence"
              value={values.periodCadence}
              onChange={(event) =>
                updateValue(
                  "periodCadence",
                  event.target.value as CampaignFormValues["periodCadence"],
                )
              }
              className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base outline-none transition focus:border-mint-dark focus:ring-4 focus:ring-mint/15"
            >
              <option value="weekly">Every week</option>
              <option value="daily">Every day</option>
            </select>
            <span className="mt-2 block text-sm leading-6 text-ink-soft">
              A new round starts after the previous round closes.
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Time zone</span>
            <select
              name="timezone"
              value={values.timezone}
              onChange={(event) => updateValue("timezone", event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base outline-none transition focus:border-mint-dark focus:ring-4 focus:ring-mint/15"
            >
              <option value="Asia/Jakarta">Asia/Jakarta</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/London">Europe/London</option>
            </select>
            <span className="mt-2 block text-sm leading-6 text-ink-soft">
              Round timing follows this local time zone.
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Round closes at</span>
            <input
              type="time"
              name="close_local_time"
              required
              step={60}
              value={values.closeLocalTime}
              onChange={(event) => updateValue("closeLocalTime", event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base outline-none transition focus:border-mint-dark focus:ring-4 focus:ring-mint/15"
            />
          </label>
          <label className={cn("block", values.periodCadence === "daily" && "opacity-50")}>
            <span className="mb-2 block text-sm font-semibold">Weekly close day</span>
            <select
              name="close_weekday"
              value={values.closeWeekday}
              disabled={values.periodCadence === "daily"}
              onChange={(event) => updateValue("closeWeekday", event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base outline-none transition focus:border-mint-dark focus:ring-4 focus:ring-mint/15 disabled:cursor-not-allowed"
            >
              {weekdays.map((day, index) => (
                <option key={day} value={index}>{day}</option>
              ))}
            </select>
            {values.periodCadence === "daily" && (
              <input type="hidden" name="close_weekday" value={values.closeWeekday} />
            )}
          </label>
        </div>

        <fieldset className="mt-8">
          <legend className="text-base font-semibold">How should votes divide the commitment?</legend>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
            The allocation model turns the final vote count into a payment plan for your review.
            It does not charge your account automatically.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {allocationOptions.map((option) => (
              <label
                key={option.value}
                className="relative cursor-pointer rounded-2xl border border-line bg-white p-5 transition hover:border-mint-dark/35 has-[:checked]:border-mint-dark has-[:checked]:bg-mint/10 has-[:checked]:shadow-[0_8px_24px_rgba(31,114,93,0.1)]"
              >
                <input
                  type="radio"
                  name="allocation_model"
                  value={option.value}
                  checked={values.allocationModel === option.value}
                  onChange={() => updateValue("allocationModel", option.value)}
                  className="absolute right-4 top-4 size-4 accent-[#1f725d]"
                />
                <span className="block pr-7 font-semibold">{option.title}</span>
                <span className="mt-2 block text-sm leading-6 text-ink-soft">{option.description}</span>
                <span className="mt-4 block text-xs font-semibold leading-5 text-mint-dark">
                  {option.bestFor}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section
        hidden={currentStep !== 5}
        aria-labelledby="campaign-step-5"
        className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8"
      >
        <div className="mb-7 flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-mint/25 text-mint-dark">
            <Check className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="campaign-step-5" data-step-heading="5" tabIndex={-1} className="text-2xl font-semibold outline-none">
              Make sure everything feels right
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-ink-soft">
              Your campaign will remain a private draft after this step. You can preview it and
              publish when you are ready.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-[1.5rem] bg-ink text-white">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint">Campaign preview</p>
            <h3 className="display-type mt-3 text-3xl font-semibold sm:text-4xl">
              {values.title || "Untitled campaign"}
            </h3>
            <p className="mt-3 max-w-3xl leading-7 text-white/70">
              {values.summary || "Your campaign explanation will appear here."}
            </p>
          </div>
          <div className="grid border-t border-white/10 sm:grid-cols-3">
            <div className="p-5 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Commitment</p>
              <p className="mt-2 text-xl font-semibold">{formatAmount(values.amount, values.currency)}</p>
              <button type="button" onClick={() => goToStep(2)} className="mt-3 text-sm font-semibold text-mint hover:text-white">Edit</button>
            </div>
            <div className="border-t border-white/10 p-5 sm:border-l sm:border-t-0 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Round</p>
              <p className="mt-2 text-xl font-semibold capitalize">{values.periodCadence}</p>
              <p className="mt-1 text-sm text-white/60">
                {values.periodCadence === "weekly" ? `${weekdays[Number(values.closeWeekday)]} at ` : "Closes at "}
                {values.closeLocalTime}
              </p>
              <button type="button" onClick={() => goToStep(4)} className="mt-3 text-sm font-semibold text-mint hover:text-white">Edit</button>
            </div>
            <div className="border-t border-white/10 p-5 sm:border-l sm:border-t-0 sm:p-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Allocation</p>
              <p className="mt-2 text-lg font-semibold">{selectedAllocation.title}</p>
              <button type="button" onClick={() => goToStep(4)} className="mt-3 text-sm font-semibold text-mint hover:text-white">Edit</button>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-paper p-5 ring-1 ring-ink/8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Users className="size-5 text-mint-dark" aria-hidden="true" />
              <p className="font-semibold">{selectedOrganizations.length} recipient partners</p>
            </div>
            <button type="button" onClick={() => goToStep(3)} className="text-sm font-semibold text-mint-dark hover:text-ink">Edit</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedOrganizations.map((organization) => (
              <span key={organization.id} className="rounded-full bg-white px-3 py-2 text-sm font-semibold ring-1 ring-ink/8">
                {organization.name}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <FormMessage error={state.error} />
        </div>
      </section>

      {stepError && (
        <div role="alert" className="rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral-dark ring-1 ring-coral/25">
          {stepError}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 rounded-[1.5rem] bg-surface p-4 ring-1 ring-ink/8 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          {currentStep > 1 && (
            <button
              type="button"
              onClick={() => goToStep(currentStep - 1)}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-line bg-white px-6 font-semibold text-ink transition hover:border-ink/25 sm:w-auto"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Back
            </button>
          )}
        </div>

        {currentStep < steps.length ? (
          <button
            type="button"
            onClick={continueToNextStep}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 font-semibold text-white shadow-[0_10px_24px_rgba(16,38,63,0.18)] transition hover:-translate-y-0.5 hover:bg-ink/90"
          >
            Continue <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <SubmitButton pendingLabel={isEditing ? "Saving changes…" : "Creating draft…"} className="shrink-0">
            {isEditing ? "Save draft changes" : "Create draft campaign"}
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
