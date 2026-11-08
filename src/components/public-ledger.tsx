"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, X } from "lucide-react";
import type { Database } from "@/lib/database.types";
import type { CampaignLifetimeTotals } from "@/lib/campaign-lifetime";
import { formatMoney } from "@/lib/money";

type PublicLedgerRow =
  Database["public"]["Functions"]["get_campaign_public_ledger"]["Returns"][number];

export function PublicLedger({
  rows,
  organizationNames,
  committedMinor,
  currency,
  cadenceLabel,
  lifetime,
}: {
  rows: PublicLedgerRow[];
  organizationNames: Map<number, string>;
  committedMinor: number;
  currency: string;
  cadenceLabel: string;
  lifetime: CampaignLifetimeTotals;
}) {
  const [open, setOpen] = useState(false);
  const snapshot = rows[0];
  const paymentByOrganization = new Map(
    lifetime.recipientPayments.map((item) => [item.organizationId, item]),
  );

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
        <div className="grid overflow-hidden rounded-2xl shadow-[0_12px_28px_rgba(16,38,63,0.12)] sm:grid-cols-3">
          <Summary tone="navy" label="Committed" value={formatMoney(committedMinor, currency)} note={`each ${cadenceLabel}`} />
          <Summary tone="mint" label="Allocated" value={snapshot ? formatMoney(snapshot.allocated_minor, snapshot.currency) : "Pending"} note={snapshot ? `round ${snapshot.period_sequence}` : "after voting closes"} />
          <Summary tone="coral" label="Lifetime payments" value={formatMoney(lifetime.paidMinor, currency)} note={`${lifetime.paymentCount} confirmed payment${lifetime.paymentCount === 1 ? "" : "s"}`} onInfo={() => setOpen(true)} />
        </div>
      </section>

      {open && (
        <div className="overlay-enter fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="ledger-title" className="modal-enter max-h-[min(42rem,calc(100dvh-2rem))] w-full max-w-2xl overflow-y-auto rounded-3xl bg-surface shadow-2xl">
            <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-line bg-surface/95 p-6 backdrop-blur">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-mint-dark">Campaign accountability</p>
                <h2 id="ledger-title" className="mt-2 text-2xl font-semibold">Lifetime totals</h2>
                <p className="mt-1 text-sm text-ink-soft">Funding and confirmed recipient payments across this campaign.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close lifetime totals" className="grid size-10 shrink-0 place-items-center rounded-full border border-ink/10 bg-white"><X className="size-4" /></button>
            </header>

            <div className="grid gap-3 p-6 sm:grid-cols-3">
              <DetailSummary label="Lifetime committed" value={formatMoney(lifetime.committedMinor, currency)} />
              <DetailSummary label="Lifetime allocated" value={formatMoney(lifetime.allocatedMinor, currency)} />
              <DetailSummary label="Lifetime paid" value={formatMoney(lifetime.paidMinor, currency)} />
            </div>
            <p className="mx-6 rounded-2xl bg-mint/10 px-4 py-3 text-xs font-semibold text-mint-dark ring-1 ring-mint/20">
              {lifetime.completedPeriods} completed round{lifetime.completedPeriods === 1 ? "" : "s"} · {lifetime.paymentCount} confirmed payment{lifetime.paymentCount === 1 ? "" : "s"}
            </p>
            <div className="mt-5 divide-y divide-line border-t border-line">
              {[...organizationNames].map(([organizationId, name]) => {
                const totals = paymentByOrganization.get(organizationId);
                return (
                  <div key={organizationId} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                      <p className="font-semibold">{name}</p>
                      <p className="mt-1 text-xs text-ink-soft">{totals?.paymentCount ?? 0} confirmed payment{totals?.paymentCount === 1 ? "" : "s"}</p>
                    </div>
                    <p className="inline-flex items-center gap-1.5 font-semibold sm:text-right">
                      {(totals?.paidMinor ?? 0) > 0 && <CheckCircle2 className="size-4 text-mint-dark" />}
                      {formatMoney(totals?.paidMinor ?? 0, currency)}
                    </p>
                  </div>
                );
              })}
            </div>
            {lifetime.sandboxPaidMinor > 0 && (
              <p className="border-t border-line px-6 py-4 text-xs text-ink-soft">
                Includes {formatMoney(lifetime.sandboxPaidMinor, currency)} in sandbox test payments. Live confirmed: {formatMoney(lifetime.livePaidMinor, currency)}.
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

function Summary({
  label,
  value,
  note,
  tone,
  onInfo,
}: {
  label: string;
  value: string;
  note: string;
  tone: "navy" | "mint" | "coral";
  onInfo?: () => void;
}) {
  const toneClass = tone === "navy"
    ? "bg-ink text-white"
    : tone === "mint"
      ? "bg-mint text-ink"
      : "bg-coral text-white";

  return (
    <div className={`impact-summary-segment relative flex min-h-24 items-center justify-between gap-4 px-5 py-4 ${toneClass}`}>
      <div className="min-w-0">
        <p className={`text-[0.65rem] font-bold uppercase tracking-[0.14em] ${tone === "mint" ? "text-ink/60" : "text-white/70"}`}>{label}</p>
        <p className="mt-0.5 truncate text-xl font-semibold">{value}</p>
        <p className={`mt-0.5 text-xs ${tone === "mint" ? "text-ink/60" : "text-white/70"}`}>{note}</p>
      </div>
      {onInfo && (
        <button type="button" onClick={onInfo} aria-label="View allocation details" className="grid size-9 shrink-0 place-items-center rounded-full border border-white/35 bg-white/15 text-white transition hover:bg-white/25">
          <Info className="size-4" />
        </button>
      )}
    </div>
  );
}

function DetailSummary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/8"><p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-ink-soft">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}
