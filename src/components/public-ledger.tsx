"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, LockKeyhole, X } from "lucide-react";
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

function paymentStatusLabel(row: PublicLedgerRow) {
  if (row.donation_status === "confirmed_paid") {
    if (row.donation_environment === "sandbox") return "Sandbox test completed";
    if (row.donation_environment === "simulation") return "Company-reported paid";
    return "Confirmed paid";
  }
  return row.donation_status
    ? statusLabels[row.donation_status] ?? row.donation_status
    : "Not allocated";
}

export function PublicLedger({
  rows,
  organizationNames,
}: {
  rows: PublicLedgerRow[];
  organizationNames: Map<number, string>;
}) {
  const [open, setOpen] = useState(false);
  const snapshot = rows[0];
  const liveConfirmedMinor = rows.reduce((sum, row) => sum + row.confirmed_paid_minor, 0);
  const sandboxConfirmedMinor = rows.reduce((sum, row) => sum + row.sandbox_confirmed_minor, 0);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <>
      <section className="border-b border-line bg-paper/70 px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
            <Summary label="Committed" value={snapshot ? formatMoney(snapshot.budget_minor, snapshot.currency) : "—"} />
            <Summary label="Allocated" value={snapshot ? formatMoney(snapshot.allocated_minor, snapshot.currency) : "Pending"} />
            <Summary className="hidden sm:block" label="Confirmed" value={snapshot ? formatMoney(liveConfirmedMinor, snapshot.currency) : "—"} />
          </div>
          <button type="button" onClick={() => setOpen(true)} aria-label="View allocation details" className="grid size-10 shrink-0 place-items-center rounded-full border border-ink/10 bg-white text-ink-soft transition hover:border-ink/25 hover:text-ink">
            <Info className="size-4" />
          </button>
        </div>
      </section>

      {open && (
        <div className="overlay-enter fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="ledger-title" className="modal-enter max-h-[min(42rem,calc(100dvh-2rem))] w-full max-w-2xl overflow-y-auto rounded-3xl bg-surface shadow-2xl">
            <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-line bg-surface/95 p-6 backdrop-blur">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-mint-dark">Campaign accountability</p>
                <h2 id="ledger-title" className="mt-2 text-2xl font-semibold">Allocation details</h2>
                <p className="mt-1 text-sm text-ink-soft">How the campaign commitment was assigned and confirmed.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close allocation details" className="grid size-10 shrink-0 place-items-center rounded-full border border-ink/10 bg-white"><X className="size-4" /></button>
            </header>

            {!snapshot ? (
              <div className="p-6 text-sm leading-6 text-ink-soft">Voting is still in progress. The first frozen allocation will appear after this round closes.</div>
            ) : (
              <>
                <div className="grid gap-3 p-6 sm:grid-cols-3">
                  <DetailSummary label="Committed" value={formatMoney(snapshot.budget_minor, snapshot.currency)} />
                  <DetailSummary label="Allocated" value={formatMoney(snapshot.allocated_minor, snapshot.currency)} />
                  <DetailSummary label="Confirmed" value={formatMoney(liveConfirmedMinor, snapshot.currency)} />
                </div>
                <div className="mx-6 flex items-center justify-between gap-4 rounded-2xl bg-mint/10 px-4 py-3 text-xs font-semibold text-mint-dark ring-1 ring-mint/20">
                  <span>Period {snapshot.period_sequence} · revision {snapshot.snapshot_revision}</span>
                  <span className="inline-flex items-center gap-1.5 capitalize"><LockKeyhole className="size-3.5" /> {snapshot.allocation_state.replaceAll("_", " ")}</span>
                </div>
                <div className="mt-5 divide-y divide-line border-t border-line">
                  {rows.map((row) => (
                    <div key={row.organization_id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                      <div>
                        <p className="font-semibold">{organizationNames.get(row.organization_id) ?? "Organization"}</p>
                        <p className="mt-1 text-xs text-ink-soft">{row.vote_count} valid votes</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="font-semibold">{formatMoney(row.amount_minor, row.currency)}</p>
                        <p className={`mt-1 inline-flex items-center gap-1.5 text-xs font-semibold ${row.donation_environment === "sandbox" ? "text-[#005ea6]" : "text-mint-dark"}`}>
                          {row.donation_status === "confirmed_paid" && <CheckCircle2 className="size-3.5" />}
                          {paymentStatusLabel(row)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {sandboxConfirmedMinor > 0 && (
                  <p className="border-t border-line px-6 py-4 text-xs text-ink-soft">Sandbox evidence: {formatMoney(sandboxConfirmedMinor, snapshot.currency)}</p>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function Summary({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return <div className={className}><p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-ink-soft">{label}</p><p className="mt-0.5 truncate text-sm font-semibold text-ink sm:text-base">{value}</p></div>;
}

function DetailSummary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/8"><p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-ink-soft">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}
