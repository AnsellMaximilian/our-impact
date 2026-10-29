"use client";

import type { FormEvent } from "react";
import {
  finalizeCampaignPeriodNow,
  recordDonationStatus,
  resolveZeroVoteAllocation,
} from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/submit-button";

const statusLabels: Record<string, string> = {
  approved_for_payment: "Approve for payment",
  payment_pending: "Mark payment pending",
  confirmed_paid: "Confirm company-reported payment",
  payment_failed: "Mark payment failed",
  canceled: "Cancel record",
  requires_reconciliation: "Flag for reconciliation",
};

const allowedTransitions: Record<string, string[]> = {
  allocated: ["approved_for_payment", "canceled"],
  approved_for_payment: ["payment_pending", "canceled"],
  payment_pending: [
    "confirmed_paid",
    "payment_failed",
    "requires_reconciliation",
  ],
  payment_failed: ["payment_pending", "canceled", "requires_reconciliation"],
  confirmed_paid: ["requires_reconciliation"],
  requires_reconciliation: ["confirmed_paid", "payment_failed", "canceled"],
  canceled: [],
};

function confirmSubmit(message: string) {
  return (event: FormEvent<HTMLFormElement>) => {
    if (!window.confirm(message)) event.preventDefault();
  };
}

export function PeriodFinalizationControls({
  campaignId,
  periodId,
}: {
  campaignId: string;
  periodId: string;
}) {
  return (
    <form
      action={finalizeCampaignPeriodNow}
      onSubmit={confirmSubmit(
        "Close voting now and freeze this period’s allocation? This does not send money.",
      )}
      className="mt-5 rounded-2xl bg-sun/15 p-5 ring-1 ring-sun/35"
    >
      <input type="hidden" name="campaign_id" value={campaignId} />
      <input type="hidden" name="period_id" value={periodId} />
      <p className="text-sm font-semibold">Need to test the close workflow early?</p>
      <p className="mt-1 text-sm leading-6 text-ink-soft">
        This closes voting, creates an immutable allocation, and opens the next period. It never initiates a donation.
      </p>
      <SubmitButton pendingLabel="Freezing allocation…" className="mt-4 min-h-10 px-4 text-sm">
        Close voting &amp; freeze allocation now
      </SubmitButton>
    </form>
  );
}

export function ZeroVoteReviewControls({
  campaignId,
  snapshotId,
}: {
  campaignId: string;
  snapshotId: string;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
      <form
        action={resolveZeroVoteAllocation}
        onSubmit={confirmSubmit(
          "Create a new immutable revision that splits the commitment equally?",
        )}
      >
        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="snapshot_id" value={snapshotId} />
        <input type="hidden" name="resolution" value="equal_split" />
        <SubmitButton pendingLabel="Creating revision…" className="min-h-10 px-4 text-sm">
          Split equally
        </SubmitButton>
      </form>
      <form
        action={resolveZeroVoteAllocation}
        onSubmit={confirmSubmit(
          "Cancel this period’s allocation? The original review snapshot remains in the audit history.",
        )}
      >
        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="snapshot_id" value={snapshotId} />
        <input type="hidden" name="resolution" value="canceled" />
        <SubmitButton
          pendingLabel="Creating revision…"
          className="min-h-10 bg-coral-dark px-4 text-sm hover:bg-coral-dark/90"
        >
          Cancel allocation
        </SubmitButton>
      </form>
    </div>
  );
}

export function DonationStatusForm({
  campaignId,
  donationRecordId,
  currentStatus,
}: {
  campaignId: string;
  donationRecordId: string;
  currentStatus: string;
}) {
  const transitions = allowedTransitions[currentStatus] ?? [];
  if (transitions.length === 0) return null;

  return (
    <details className="mt-3 rounded-xl bg-paper p-3 ring-1 ring-ink/8">
      <summary className="cursor-pointer text-xs font-semibold text-ink-soft">
        Record a status update
      </summary>
      <form action={recordDonationStatus} className="mt-3 grid gap-3">
        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="donation_record_id" value={donationRecordId} />
        <select
          name="status"
          required
          defaultValue=""
          className="min-h-10 rounded-xl border border-line bg-white px-3 text-sm"
        >
          <option value="" disabled>Choose next status</option>
          {transitions.map((status) => (
            <option key={status} value={status}>{statusLabels[status] ?? status}</option>
          ))}
        </select>
        <input
          name="evidence_reference"
          maxLength={500}
          placeholder="Evidence reference or URL (optional)"
          className="min-h-10 rounded-xl border border-line bg-white px-3 text-sm"
        />
        <textarea
          name="note"
          maxLength={1000}
          rows={2}
          placeholder="Audit note (optional)"
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm"
        />
        <SubmitButton pendingLabel="Recording…" className="min-h-10 justify-self-start px-4 text-sm">
          Record update
        </SubmitButton>
      </form>
    </details>
  );
}
