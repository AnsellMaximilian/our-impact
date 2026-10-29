import { CheckCircle2, Clock3, LockKeyhole } from "lucide-react";
import type { Database } from "@/lib/database.types";
import { formatMoney } from "@/lib/money";

type PublicLedgerRow =
  Database["public"]["Functions"]["get_campaign_public_ledger"]["Returns"][number];

const statusLabels: Record<string, string> = {
  allocated: "Allocated · awaiting approval",
  approved_for_payment: "Approved · not sent",
  payment_pending: "Payment pending",
  confirmed_paid: "Company-reported paid",
  payment_failed: "Payment failed",
  canceled: "Canceled",
  requires_reconciliation: "Needs reconciliation",
};

export function PublicLedger({
  rows,
  organizationNames,
}: {
  rows: PublicLedgerRow[];
  organizationNames: Map<number, string>;
}) {
  const snapshot = rows[0];
  if (!snapshot) {
    return (
      <section className="mt-8 rounded-3xl bg-paper p-6 ring-1 ring-ink/8">
        <div className="flex items-center gap-2">
          <Clock3 className="size-5 text-mint-dark" aria-hidden="true" />
          <h2 className="font-semibold">Transparent allocation ledger</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          Voting is still in progress. A frozen allocation will appear here after the first period closes.
        </p>
      </section>
    );
  }

  const confirmedPaidMinor = rows.reduce(
    (sum, row) => sum + row.confirmed_paid_minor,
    0,
  );

  return (
    <section className="mt-8 overflow-hidden rounded-3xl border border-line bg-white">
      <div className="flex flex-col gap-3 bg-paper p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-mint-dark">
            Transparent allocation ledger
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            Period {snapshot.period_sequence} · revision {snapshot.snapshot_revision}
          </h2>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-mint/15 px-3 py-2 text-xs font-bold capitalize text-mint-dark ring-1 ring-mint/25">
          <LockKeyhole className="size-4" aria-hidden="true" />
          {snapshot.allocation_state.replaceAll("_", " ")}
        </span>
      </div>

      <div className="grid gap-3 p-6 sm:grid-cols-3">
        <div className="rounded-2xl bg-ink p-4 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">Committed</p>
          <p className="mt-2 text-xl font-semibold">{formatMoney(snapshot.budget_minor, snapshot.currency)}</p>
        </div>
        <div className="rounded-2xl bg-mint/12 p-4 ring-1 ring-mint/25">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-mint-dark">Allocated</p>
          <p className="mt-2 text-xl font-semibold">{formatMoney(snapshot.allocated_minor, snapshot.currency)}</p>
        </div>
        <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/8">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">Company-reported paid</p>
          <p className="mt-2 text-xl font-semibold">{formatMoney(confirmedPaidMinor, snapshot.currency)}</p>
        </div>
      </div>

      <div className="divide-y divide-line border-t border-line">
        {rows.map((row) => (
          <div key={row.organization_id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{organizationNames.get(row.organization_id) ?? "Organization"}</p>
              <p className="mt-1 text-xs text-ink-soft">{row.vote_count} valid votes</p>
            </div>
            <div className="sm:text-right">
              <p className="font-semibold">{formatMoney(row.amount_minor, row.currency)}</p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-mint-dark">
                {row.donation_status === "confirmed_paid" && <CheckCircle2 className="size-3.5" aria-hidden="true" />}
                {row.donation_status ? statusLabels[row.donation_status] ?? row.donation_status : "Not allocated"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
