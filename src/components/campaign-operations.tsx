import {
  BadgeCheck,
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
}) {
  const periodDonations = latestSnapshot
    ? donationRecords.filter((record) => record.period_id === latestSnapshot.period_id)
    : [];
  const donationIds = new Set(periodDonations.map((record) => record.id));
  const periodPayments = paymentTransactions.filter((payment) =>
    donationIds.has(payment.donation_record_id),
  );
  const reviewRequired = latestSnapshot?.state === "requires_review";
  const approvedCount = periodDonations.filter((record) =>
    ["approved_for_payment", "payment_pending", "confirmed_paid", "requires_reconciliation"].includes(record.status),
  ).length;
  const settledCount = periodDonations.filter((record) => record.status === "confirmed_paid").length;
  const failedPayment = periodDonations.some((record) =>
    ["payment_failed", "requires_reconciliation"].includes(record.status),
  ) || periodPayments.some((payment) => ["failed", "request_failed", "requires_reconciliation"].includes(payment.status));
  const allSettled = periodDonations.length > 0 && settledCount === periodDonations.length;

  let nextAction = "Keep collecting votes; the scheduler will freeze the allocation at the displayed close time.";
  if (reviewRequired) {
    nextAction = "The latest period closed without valid votes. Choose an equal split or cancel it in the payment ledger.";
  } else if (periodDonations.some((record) => record.status === "allocated")) {
    nextAction = "Review the frozen amounts, then explicitly approve each recipient allocation for payment.";
  } else if (periodDonations.some((record) => record.status === "approved_for_payment")) {
    nextAction = "Approved allocations are ready for an explicit PayPal Sandbox payout.";
  } else if (failedPayment) {
    nextAction = "A payment needs attention. Review its provider reference before retrying or reconciling it.";
  } else if (periodDonations.some((record) => record.status === "payment_pending")) {
    nextAction = "PayPal is processing the test payout. Webhooks and Render reconciliation will update it.";
  } else if (allSettled) {
    nextAction = "The latest period is settled. The new voting period can continue independently.";
  }

  return (
    <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Campaign operations</p>
          <h2 className="mt-2 text-2xl font-semibold">From voting close to verified payment</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
            Closing freezes evidence; it never silently moves money. Every later payment step remains visible and deliberate.
          </p>
        </div>
        <a href="#campaign-ledger" className="inline-flex w-fit rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white">
          Open payment ledger
        </a>
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
          label="Allocation"
          detail={latestSnapshot
            ? `Period ${latestClosedPeriodSequence ?? "—"} froze ${formatMoney(latestSnapshot.allocated_minor, currency)}.`
            : "The first immutable snapshot appears after a close."}
          status={reviewRequired ? "attention" : latestSnapshot ? "complete" : "waiting"}
        />
        <Step
          icon={BadgeCheck}
          label="Approval"
          detail={reviewRequired
            ? `${formatMoney(latestSnapshot?.unallocated_minor ?? 0, currency)} needs a zero-vote decision.`
            : periodDonations.length
              ? `${approvedCount} of ${periodDonations.length} recipient allocations approved.`
              : "No allocation is awaiting approval yet."}
          status={reviewRequired ? "attention" : approvedCount === periodDonations.length && periodDonations.length ? "complete" : periodDonations.length ? "current" : "waiting"}
        />
        <Step
          icon={failedPayment ? CircleAlert : CircleDollarSign}
          label="Payment evidence"
          detail={periodDonations.length
            ? `${settledCount} of ${periodDonations.length} recipient allocations verified complete.`
            : "No payment is expected until allocation approval."}
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
