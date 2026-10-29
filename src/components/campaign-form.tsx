"use client";

import { useActionState } from "react";
import { Building2, CalendarDays, Coins, Sparkles } from "lucide-react";
import {
  createDraftCampaign,
  type DashboardActionState,
} from "@/app/dashboard/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import type { TableRow } from "@/lib/database.types";

const initialState: DashboardActionState = {};

export function CampaignForm({
  organizations,
}: {
  organizations: TableRow<"organizations">[];
}) {
  const [state, action] = useActionState(createDraftCampaign, initialState);

  return (
    <form action={action} className="space-y-8">
      <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-mint/25 text-mint-dark">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">Step 1</p>
            <h2 className="text-xl font-semibold">Tell the public what this is for</h2>
          </div>
        </div>

        <div className="grid gap-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Campaign title</span>
            <input
              name="title"
              required
              minLength={3}
              maxLength={120}
              placeholder="A brighter neighborhood, chosen together"
              className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold">One-sentence explanation</span>
            <textarea
              name="summary"
              required
              minLength={20}
              maxLength={280}
              rows={3}
              placeholder="We’ve committed this weekly budget, and our community will help choose how it is allocated."
              className="w-full resize-y rounded-2xl border border-line bg-white px-4 py-3 text-base leading-7"
            />
          </label>
        </div>
      </section>

      <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-sun/30 text-ink">
            <Coins className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">Step 2</p>
            <h2 className="text-xl font-semibold">Set the commitment</h2>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-[1fr_9rem]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Budget per period</span>
            <input
              name="amount"
              inputMode="decimal"
              required
              placeholder="100.00"
              className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Currency</span>
            <select
              name="currency"
              defaultValue="USD"
              className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base"
            >
              <option value="USD">USD</option>
              <option value="IDR">IDR</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          This is a commitment limit, not money held by Our Impact.
        </p>
      </section>

      <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-coral/15 text-coral-dark">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">Step 3</p>
            <h2 className="text-xl font-semibold">Choose 2–5 fictional organizations</h2>
          </div>
        </div>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Organizations in this campaign</legend>
          {organizations.map((organization) => (
            <label
              key={organization.id}
              className="group flex cursor-pointer gap-4 rounded-2xl border border-line bg-white p-4 transition hover:border-mint-dark/35 hover:shadow-sm has-[:checked]:border-mint-dark has-[:checked]:bg-mint/10"
            >
              <input
                type="checkbox"
                name="organization_ids"
                value={organization.id}
                className="mt-1 size-4 accent-[#1f725d]"
              />
              <span>
                <span className="block font-semibold">{organization.name}</span>
                <span className="mt-1 block text-sm leading-6 text-ink-soft">
                  {organization.short_description}
                </span>
                <span className="mt-2 inline-block rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold text-ink-soft">
                  {organization.category} · fictional
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-ink/8 text-ink">
            <CalendarDays className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">Step 4</p>
            <h2 className="text-xl font-semibold">Set the draft rules</h2>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Voting period</span>
            <select name="period_cadence" defaultValue="weekly" className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base">
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Time zone</span>
            <select name="timezone" defaultValue="Asia/Jakarta" className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base">
              <option value="Asia/Jakarta">Asia/Jakarta</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="Europe/London">Europe/London</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-2 block text-sm font-semibold">Allocation model</span>
            <select name="allocation_model" defaultValue="proportional" className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base">
              <option value="proportional">Proportional to votes</option>
              <option value="winner_takes_all">Winner takes all</option>
              <option value="hybrid">Hybrid base + proportional</option>
            </select>
          </label>
        </div>
      </section>

      <FormMessage error={state.error} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm leading-6 text-ink-soft">
          The campaign stays private as a draft. Publishing and real voting arrive in Stage 1.
        </p>
        <SubmitButton pendingLabel="Creating draft…" className="shrink-0">
          Create draft campaign
        </SubmitButton>
      </div>
    </form>
  );
}
