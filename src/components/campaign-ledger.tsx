import {
  CheckCircle2,
  ChevronRight,
  History,
} from "lucide-react";
import { ZeroVoteReviewControls } from "@/components/ledger-controls";
import type { TableRow } from "@/lib/database.types";
import { formatMoney } from "@/lib/money";

const statusLabels: Record<string, string> = {
  allocated: "Ready to fund",
  approved_for_payment: "Ready to fund",
  payment_pending: "Payment pending",
  confirmed_paid: "Company-reported paid",
  payment_failed: "Payment failed",
  canceled: "Canceled",
  requires_reconciliation: "Needs reconciliation",
};

function donationStatusLabel(record: TableRow<"donation_records">) {
  if (record.status === "confirmed_paid" && record.environment === "sandbox") {
    return "PayPal confirmed";
  }
  return statusLabels[record.status] ?? record.status;
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatRoundDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(value));
}

function getPayPalErrorDetails(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }
    const detail = item as { field?: unknown; issue?: unknown };
    return typeof detail.field === "string" && typeof detail.issue === "string"
      ? [{ field: detail.field, issue: detail.issue }]
      : [];
  });
}

export function CampaignLedger({
  campaignId,
  timezone,
  periods,
  snapshots,
  lines,
  donationRecords,
  paymentTransactions,
  paymentEvents,
  auditEvents,
  organizations,
}: {
  campaignId: string;
  timezone: string;
  periods: TableRow<"campaign_periods">[];
  snapshots: TableRow<"allocation_snapshots">[];
  lines: TableRow<"allocation_lines">[];
  donationRecords: TableRow<"donation_records">[];
  paymentTransactions: TableRow<"payment_transactions">[];
  paymentEvents: TableRow<"payment_events">[];
  auditEvents: TableRow<"audit_events">[];
  organizations: TableRow<"organizations">[];
}) {
  const periodById = new Map(periods.map((period) => [period.id, period]));
  const organizationById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  );
  const donationByLineId = new Map(
    donationRecords.map((record) => [record.allocation_line_id, record]),
  );
  const paymentByDonationId = new Map(
    paymentTransactions.map((transaction) => [
      transaction.donation_record_id,
      transaction,
    ]),
  );
  const paymentEventCount = new Map<string, number>();
  for (const event of paymentEvents) {
    if (!event.payment_transaction_id) continue;
    paymentEventCount.set(
      event.payment_transaction_id,
      (paymentEventCount.get(event.payment_transaction_id) ?? 0) +
        event.delivery_count,
    );
  }
  const latestSnapshotByPeriod = new Map<string, TableRow<"allocation_snapshots">>();

  for (const snapshot of snapshots) {
    const current = latestSnapshotByPeriod.get(snapshot.period_id);
    if (!current || snapshot.revision > current.revision) {
      latestSnapshotByPeriod.set(snapshot.period_id, snapshot);
    }
  }

  const latestSnapshots = [...latestSnapshotByPeriod.values()].sort(
    (left, right) =>
      (periodById.get(right.period_id)?.sequence_number ?? 0) -
      (periodById.get(left.period_id)?.sequence_number ?? 0),
  );
  const relevantEntityIds = new Set([
    ...periods.map((period) => period.id),
    ...snapshots.map((snapshot) => snapshot.id),
    ...donationRecords.map((record) => record.id),
    ...paymentTransactions.map((transaction) => transaction.id),
  ]);
  const relevantAuditEvents = auditEvents.filter((event) =>
    relevantEntityIds.has(event.entity_id),
  );
  const roundSummaries = latestSnapshots.map((snapshot) => {
    const snapshotLines = lines.filter((line) => line.snapshot_id === snapshot.id);
    const snapshotDonations = snapshotLines.flatMap((line) => {
      const record = donationByLineId.get(line.id);
      return record ? [record] : [];
    });
    const simulationConfirmedMinor = snapshotDonations
      .filter((record) => record.status === "confirmed_paid" && record.environment === "simulation")
      .reduce((sum, record) => sum + record.amount_minor, 0);
    const sandboxConfirmedMinor = snapshotDonations
      .filter((record) => record.status === "confirmed_paid" && record.environment === "sandbox")
      .reduce((sum, record) => sum + record.amount_minor, 0);
    const confirmedCount = snapshotDonations.filter((record) => record.status === "confirmed_paid").length;
    const attentionCount = snapshotDonations.filter((record) =>
      ["payment_failed", "requires_reconciliation"].includes(record.status),
    ).length;
    const paymentState = snapshot.state === "requires_review"
      ? "Not started"
      : attentionCount > 0
        ? "Needs attention"
        : snapshotDonations.length > 0 && confirmedCount === snapshotDonations.length
          ? "Confirmed"
          : snapshotDonations.length > 0
            ? "Awaiting approval"
            : "Not started";
    const displayState = snapshot.state === "requires_review"
      ? "Needs review"
      : snapshot.state === "canceled"
        ? "Canceled"
        : paymentState === "Confirmed"
          ? "Completed"
          : paymentState === "Needs attention"
            ? "Needs attention"
            : snapshot.state === "allocated"
              ? "Ready to fund"
              : snapshot.state.replaceAll("_", " ");

    return {
      snapshot,
      period: periodById.get(snapshot.period_id),
      snapshotLines,
      snapshotDonations,
      simulationConfirmedMinor,
      sandboxConfirmedMinor,
      paymentState,
      displayState,
    };
  });
  const totalCommittedMinor = roundSummaries.reduce(
    (sum, round) => sum + round.snapshot.budget_minor,
    0,
  );
  const totalAllocatedMinor = roundSummaries.reduce(
    (sum, round) => sum + round.snapshot.allocated_minor,
    0,
  );
  const totalConfirmedMinor = roundSummaries.reduce(
    (sum, round) => sum + round.simulationConfirmedMinor + round.sandboxConfirmedMinor,
    0,
  );
  const attentionRounds = roundSummaries.filter((round) =>
    ["Needs review", "Needs attention", "Ready to fund"].includes(round.displayState),
  ).length;
  const ledgerCurrency = roundSummaries[0]?.snapshot.currency ?? "USD";

  return (
    <section id="campaign-ledger" className="scroll-mt-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint-dark">
            Campaign record
          </p>
          <h2 className="display-type mt-2 text-3xl font-semibold">Round history</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
            Scan every commitment, then expand a round when you need its recipient or payment details.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-mint-dark ring-1 ring-ink/10">
          <CheckCircle2 className="size-4" aria-hidden="true" /> {roundSummaries.length} recorded rounds
        </span>
      </div>

      {latestSnapshots.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white p-5 text-sm leading-6 text-ink-soft ring-1 ring-ink/8">
          The first payment record will appear after a voting round ends.
        </div>
      ) : (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-mint/10 px-5 py-4 ring-1 ring-mint/20"><p className="text-xs font-bold uppercase tracking-[0.12em] text-mint-dark">Committed</p><p className="mt-1 text-2xl font-semibold">{formatMoney(totalCommittedMinor, ledgerCurrency)}</p></div>
            <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-ink/10"><p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">Allocated</p><p className="mt-1 text-2xl font-semibold">{formatMoney(totalAllocatedMinor, ledgerCurrency)}</p></div>
            <div className="rounded-2xl bg-white px-5 py-4 ring-1 ring-ink/10"><p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">Confirmed</p><p className="mt-1 text-2xl font-semibold">{formatMoney(totalConfirmedMinor, ledgerCurrency)}</p></div>
            <div className={attentionRounds > 0 ? "rounded-2xl bg-sun/18 px-5 py-4 ring-1 ring-sun/30" : "rounded-2xl bg-white px-5 py-4 ring-1 ring-ink/10"}><p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">Needs action</p><p className="mt-1 text-2xl font-semibold">{attentionRounds}</p></div>
          </div>

          <div className="mt-5 overflow-hidden rounded-3xl bg-white ring-1 ring-ink/12">
            <div className="hidden grid-cols-[2rem_1.2fr_1fr_.65fr_.9fr_.9fr_1fr_1fr] gap-3 border-b border-line bg-paper px-5 py-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-soft lg:grid">
              <span /><span>Round</span><span>Closed</span><span>Votes</span><span>Committed</span><span>Allocated</span><span>Payment</span><span>Status</span>
            </div>
            <div className="divide-y divide-line">
          {roundSummaries.map(({ snapshot, period, snapshotLines, paymentState, displayState }, index) => {
            const statusClass = displayState === "Completed"
              ? "bg-mint/18 text-mint-dark"
              : displayState === "Canceled"
                ? "bg-coral/10 text-coral-dark"
                : displayState === "Needs review" || displayState === "Needs attention"
                  ? "bg-sun/25 text-ink"
                  : "bg-[#edf7ff] text-[#005ea6]";
            return (
              <details key={snapshot.id} name="campaign-rounds" className="group" open={index === 0 && displayState !== "Completed"}>
                <summary className="grid cursor-pointer list-none grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 transition hover:bg-paper/70 sm:px-5 lg:grid-cols-[2rem_1.2fr_1fr_.65fr_.9fr_.9fr_1fr_1fr]">
                  <span className="grid size-7 place-items-center rounded-full text-ink-soft transition group-open:bg-ink group-open:text-white"><ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden="true" /></span>
                  <div className="min-w-0"><p className="font-semibold">Round {period?.sequence_number ?? "—"}</p><p className="mt-0.5 text-xs text-ink-soft lg:hidden">{period?.closed_at ? formatRoundDate(period.closed_at, timezone) : "Closed period"}</p></div>
                  <span className={`justify-self-end rounded-full px-3 py-1 text-xs font-bold lg:hidden ${statusClass}`}>{displayState}</span>
                  <span className="hidden text-sm text-ink-soft lg:block">{period?.closed_at ? formatRoundDate(period.closed_at, timezone) : "—"}</span>
                  <span className="hidden text-sm lg:block">{snapshot.total_valid_votes}</span>
                  <span className="hidden text-sm font-semibold lg:block">{formatMoney(snapshot.budget_minor, snapshot.currency)}</span>
                  <span className="hidden text-sm font-semibold lg:block">{formatMoney(snapshot.allocated_minor, snapshot.currency)}</span>
                  <span className={`hidden text-sm font-semibold lg:block ${paymentState === "Confirmed" ? "text-mint-dark" : paymentState === "Needs attention" ? "text-coral-dark" : "text-ink-soft"}`}>{paymentState}</span>
                  <span className={`hidden w-fit rounded-full px-3 py-1 text-xs font-bold lg:inline-flex ${statusClass}`}>{displayState}</span>
                </summary>

                <div className="border-t border-line bg-paper/55 px-4 py-4 sm:px-5">
                {snapshot.state === "requires_review" ? (
                  <div className="rounded-2xl bg-sun/15 p-5 ring-1 ring-sun/35">
                    <p className="font-semibold">No valid votes were recorded.</p>
                    <p className="mt-1 text-sm leading-6 text-ink-soft">
                      Choose an equal split or cancel this allocation. Either choice creates a new revision and keeps this review record.
                    </p>
                    <ZeroVoteReviewControls campaignId={campaignId} snapshotId={snapshot.id} />
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/10">
                    {snapshotLines.map((line) => {
                      const organization = organizationById.get(line.organization_id);
                      const donation = donationByLineId.get(line.id);
                      const payment = donation
                        ? paymentByDonationId.get(donation.id)
                        : undefined;
                      const paymentErrorDetails = payment
                        ? getPayPalErrorDetails(payment.error_details)
                        : [];
                      return (
                        <div key={line.id} className="grid gap-3 border-b border-line p-4 last:border-b-0 md:grid-cols-[1fr_auto] md:items-start">
                          <div>
                            <p className="font-semibold">{organization?.name ?? "Organization"}</p>
                            <p className="mt-1 text-xs text-ink-soft">{line.vote_count} valid votes · {formatMoney(line.amount_minor, snapshot.currency)} allocated</p>
                          </div>
                          <div className="md:w-80">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-mint-dark">
                                {donation ? donationStatusLabel(donation) : line.amount_minor === 0 ? "No allocation" : "Record pending"}
                              </p>
                              {donation && (
                                <span className={`rounded-full px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide ${donation.environment === "sandbox" ? "bg-[#edf7ff] text-[#005ea6] ring-1 ring-[#0070ba]/20" : donation.environment === "live" ? "bg-mint/15 text-mint-dark" : "bg-ink/5 text-ink-soft"}`}>
                                  {donation.environment}
                                </span>
                              )}
                            </div>
                            {donation?.evidence_reference && (
                              <p className="mt-1 break-all text-xs text-ink-soft">Evidence: {donation.evidence_reference}</p>
                            )}
                            {payment && (
                              <details className="mt-2 text-xs text-ink-soft">
                                <summary className="cursor-pointer font-semibold text-[#005ea6]">View PayPal evidence</summary>
                              <div className="mt-2 rounded-xl bg-[#edf7ff] p-3 leading-5 ring-1 ring-[#0070ba]/15">
                                <p className="font-bold text-[#005ea6]">Previous PayPal record · {payment.status.replaceAll("_", " ")}</p>
                                <p>Recipient {payment.recipient_reference_masked}</p>
                                <p>{paymentEventCount.get(payment.id) ?? 0} verified webhook deliveries</p>
                                {payment.last_error_code && (
                                  <p className="mt-1 font-semibold text-coral-dark">
                                    Error: {payment.last_error_code.replaceAll("_", " ")}
                                  </p>
                                )}
                                {payment.provider_debug_id && (
                                  <p className="break-all">
                                    PayPal reference: {payment.provider_debug_id}
                                  </p>
                                )}
                                {paymentErrorDetails.map((detail, index) => (
                                  <p key={`${detail.field}-${index}`} className="break-words">
                                    {detail.field}: {detail.issue}
                                  </p>
                                ))}
                              </div>
                              </details>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              </details>
            );
          })}
            </div>
          </div>
        </>
      )}

      <details className="group mt-5 rounded-2xl bg-white ring-1 ring-ink/10">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
        <div className="flex items-center gap-2">
          <History className="size-5 text-mint-dark" aria-hidden="true" />
          <h3 className="font-semibold">Audit history</h3><span className="text-xs text-ink-soft">{relevantAuditEvents.length} events</span>
        </div>
        <ChevronRight className="size-4 text-ink-soft transition-transform group-open:rotate-90" aria-hidden="true" />
        </summary>
        <div className="border-t border-line px-5 pb-5">
        {relevantAuditEvents.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No finalized-period activity yet.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {relevantAuditEvents.slice(0, 12).map((event) => (
              <li key={event.id} className="flex flex-col gap-1 rounded-2xl bg-paper px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold">{event.action.replaceAll(".", " · ").replaceAll("_", " ")}</span>
                <time className="text-xs text-ink-soft">{formatDate(event.created_at, timezone)}</time>
              </li>
            ))}
          </ol>
        )}
        </div>
      </details>
    </section>
  );
}
