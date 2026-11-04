import {
  Building2,
  CircleAlert,
  CircleDollarSign,
  Clock3,
  LockKeyhole,
} from "lucide-react";
import { formatMoney } from "@/lib/money";

type OperationStatus = "complete" | "current" | "waiting" | "attention";

const statusStyles: Record<OperationStatus, string> = {
  complete: "bg-mint/15 text-mint-dark ring-mint/30",
  current: "bg-[#edf7ff] text-[#005ea6] ring-[#0070ba]/20",
  waiting: "bg-ink/5 text-ink-soft ring-ink/10",
  attention: "bg-sun/20 text-ink ring-sun/35",
};

function Step({
  icon: Icon,
  label,
  detail,
  status,
}: {
  icon: typeof Clock3;
  label: string;
  detail: string;
  status: OperationStatus;
}) {
  return (
    <li className={`rounded-2xl p-4 ring-1 ${statusStyles[status]}`}>
      <div className="flex items-center gap-2">
        <Icon className="size-4" aria-hidden="true" />
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
    </li>
  );
}

export function CampaignOperations({
  currency,
  currentPeriodSequence,
  latestClosedPeriodSequence,
  latestSnapshot,
  donationRecords,
  paymentTransactions,
  readyRecipientCount,
  recipientCount,
}: {
  currency: string;
  currentPeriodSequence: number | null;
  latestClosedPeriodSequence: number | null;
  latestSnapshot: {
    period_id: string;
    state: string;
    allocated_minor: number;
    unallocated_minor: number;
  } | null;
  donationRecords: Array<{ id: string; period_id: string; status: string }>;
  paymentTransactions: Array<{ donation_record_id: string; status: string }>;
  readyRecipientCount: number;
  recipientCount: number;
}) {
  const periodDonations = latestSnapshot
    ? donationRecords.filter((record) => record.period_id === latestSnapshot.period_id)
    : [];
  const donationIds = new Set(periodDonations.map((record) => record.id));
  const periodPayments = paymentTransactions.filter((payment) =>
    donationIds.has(payment.donation_record_id),
  );
  const reviewRequired = latestSnapshot?.state === "requires_review";
  const settledCount = periodDonations.filter((record) => record.status === "confirmed_paid").length;
  const failedPayment = periodDonations.some((record) =>
    ["payment_failed", "requires_reconciliation"].includes(record.status),
  ) || periodPayments.some((payment) => ["failed", "request_failed", "requires_reconciliation"].includes(payment.status));
  const allSettled = periodDonations.length > 0 && settledCount === periodDonations.length;
  const allRecipientsReady = recipientCount > 0 && readyRecipientCount === recipientCount;

  let nextAction = "Keep sharing the campaign while this voting round is open.";
  if (reviewRequired) {
    nextAction = "This round ended without votes. Choose an equal split or cancel the allocation.";
  } else if (failedPayment) {
    nextAction = "A recipient payment needs attention. Review the payment history before trying again.";
  } else if (periodDonations.some((record) => record.status === "payment_pending")) {
    nextAction = "PayPal is confirming the recipient payments. The results will update here.";
  } else if (allSettled) {
    nextAction = "This round is funded. Keep the next community vote moving.";
  } else if (periodDonations.length > 0 && !allRecipientsReady) {
    nextAction = "One or more selected recipients must finish PayPal setup before this round can be funded.";
  } else if (periodDonations.length > 0) {
    nextAction = "The results and recipients are ready. Open Rounds & payments to fund this round with PayPal.";
  }

  return (
    <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Campaign progress</p>
          <h2 className="mt-2 text-2xl font-semibold">From community vote to community funding</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
            Follow the current round, review the community’s choices, and fund the selected recipients.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-mint/15 px-3 py-2 text-xs font-bold text-mint-dark ring-1 ring-mint/30">
          {allSettled ? "Latest round funded" : allRecipientsReady ? "Ready for PayPal" : "Recipient setup in progress"}
        </span>
      </div>

      <ol className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Step
          icon={Clock3}
          label="Voting"
          detail={currentPeriodSequence ? `Period ${currentPeriodSequence} is open now.` : "No open voting period."}
          status={currentPeriodSequence ? "current" : "waiting"}
        />
        <Step
          icon={LockKeyhole}
          label="Results"
          detail={latestSnapshot
              ? `Round ${latestClosedPeriodSequence ?? "—"} assigned ${formatMoney(latestSnapshot.allocated_minor, currency)}.`
            : "Results will appear when the first voting round ends."}
          status={reviewRequired ? "attention" : latestSnapshot ? "complete" : "waiting"}
        />
        <Step
          icon={Building2}
          label="Recipients"
          detail={reviewRequired
            ? `${formatMoney(latestSnapshot?.unallocated_minor ?? 0, currency)} needs a zero-vote decision.`
            : recipientCount
              ? `${readyRecipientCount} of ${recipientCount} selected recipients ready to receive.`
              : "Recipient readiness appears after the first result."}
          status={reviewRequired ? "attention" : allRecipientsReady ? "complete" : recipientCount ? "current" : "waiting"}
        />
        <Step
          icon={failedPayment ? CircleAlert : CircleDollarSign}
          label="Funding"
          detail={periodDonations.length
            ? `${settledCount} of ${periodDonations.length} recipient allocations verified complete.`
            : "Funding becomes available after the first completed round."}
          status={failedPayment ? "attention" : allSettled ? "complete" : periodPayments.length ? "current" : "waiting"}
        />
      </ol>

      <div className="mt-5 rounded-2xl bg-paper px-5 py-4 ring-1 ring-ink/8">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">Recommended next action</p>
        <p className="mt-2 text-sm font-semibold leading-6">{nextAction}</p>
      </div>
    </section>
  );
}
