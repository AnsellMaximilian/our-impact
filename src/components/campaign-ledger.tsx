import {
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  History,
  LockKeyhole,
  Webhook,
} from "lucide-react";
import {
  DonationStatusForm,
  PayPalSandboxPayoutForm,
  ZeroVoteReviewControls,
} from "@/components/ledger-controls";
import type { TableRow } from "@/lib/database.types";
import { formatMoney } from "@/lib/money";
import { isPayPalSandboxSettlementCurrency } from "@/lib/paypal/core";

const statusLabels: Record<string, string> = {
  allocated: "Allocated · awaiting approval",
  approved_for_payment: "Approved · not sent",
  payment_pending: "Payment pending",
  confirmed_paid: "Company-reported paid",
  payment_failed: "Payment failed",
  canceled: "Canceled",
  requires_reconciliation: "Needs reconciliation",
};

function donationStatusLabel(record: TableRow<"donation_records">) {
  if (record.status === "confirmed_paid" && record.environment === "sandbox") {
    return "Sandbox test completed";
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
  paypalSandboxReady,
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
  paypalSandboxReady: boolean;
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

  return (
    <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint-dark">
            Stage 3 · PayPal Sandbox
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Verified test payouts and payment evidence</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
            Commitment, allocation, and payment remain separate states. PayPal actions on this page are sandbox-only; no live credentials or live-fund path exists in this stage.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-mint/15 px-3 py-2 text-xs font-bold text-mint-dark ring-1 ring-mint/30">
          <LockKeyhole className="size-4" aria-hidden="true" /> Immutable revisions
        </span>
      </div>

      <div className={`mt-6 flex gap-3 rounded-2xl p-4 text-sm ring-1 ${paypalSandboxReady ? "bg-[#edf7ff] text-[#005ea6] ring-[#0070ba]/20" : "bg-sun/15 text-ink-soft ring-sun/35"}`}>
        {paypalSandboxReady ? (
          <Webhook className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        ) : (
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden="true" />
        )}
        <p className="leading-6">
          {paypalSandboxReady
            ? "Sandbox client credentials and the webhook ID are configured. Payout testing is currently limited to USD campaigns, and verified item webhooks control final test status."
            : "Add the three PayPal Sandbox environment variables and redeploy before sending test payouts. Allocation and simulation tools remain available."}
        </p>
      </div>

      {latestSnapshots.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-paper p-5 text-sm leading-6 text-ink-soft ring-1 ring-ink/8">
          The first ledger entry appears when a voting period reaches its scheduled close or is manually closed for testing.
        </div>
      ) : (
        <div className="mt-7 space-y-6">
          {latestSnapshots.map((snapshot) => {
            const period = periodById.get(snapshot.period_id);
            const snapshotLines = lines.filter(
              (line) => line.snapshot_id === snapshot.id,
            );
            const snapshotDonations = snapshotLines.flatMap((line) => {
              const record = donationByLineId.get(line.id);
              return record ? [record] : [];
            });
            const simulationConfirmedMinor = snapshotDonations
              .filter(
                (record) =>
                  record.status === "confirmed_paid" &&
                  record.environment === "simulation",
              )
              .reduce((sum, record) => sum + record.amount_minor, 0);
            const sandboxConfirmedMinor = snapshotDonations
              .filter(
                (record) =>
                  record.status === "confirmed_paid" &&
                  record.environment === "sandbox",
              )
              .reduce((sum, record) => sum + record.amount_minor, 0);

            return (
              <article key={snapshot.id} className="overflow-hidden rounded-3xl border border-line bg-white">
                <div className="flex flex-col gap-4 border-b border-line bg-paper p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
                      Period {period?.sequence_number ?? "—"} · revision {snapshot.revision}
                    </p>
                    <p className="mt-1 font-semibold">
                      {period?.closed_at
                        ? `Closed ${formatDate(period.closed_at, timezone)}`
                        : "Closed period"}
                    </p>
                  </div>
                  <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${snapshot.state === "requires_review" ? "bg-sun/25 text-ink" : snapshot.state === "canceled" ? "bg-coral/10 text-coral-dark" : "bg-mint/15 text-mint-dark"}`}>
                    {snapshot.state === "requires_review" ? (
                      <CircleAlert className="size-4" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                    )}
                    {snapshot.state.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-ink p-4 text-white">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/55">Committed</p>
                    <p className="mt-2 text-xl font-semibold">{formatMoney(snapshot.budget_minor, snapshot.currency)}</p>
                  </div>
                  <div className="rounded-2xl bg-mint/12 p-4 ring-1 ring-mint/25">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-mint-dark">Allocated</p>
                    <p className="mt-2 text-xl font-semibold">{formatMoney(snapshot.allocated_minor, snapshot.currency)}</p>
                  </div>
                  <div className="rounded-2xl bg-paper p-4 ring-1 ring-ink/8">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">Company evidence</p>
                    <p className="mt-2 text-xl font-semibold">{formatMoney(simulationConfirmedMinor, snapshot.currency)}</p>
                  </div>
                  <div className="rounded-2xl bg-[#edf7ff] p-4 ring-1 ring-[#0070ba]/20">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#005ea6]">Sandbox completed</p>
                    <p className="mt-2 text-xl font-semibold">{formatMoney(sandboxConfirmedMinor, snapshot.currency)}</p>
                  </div>
                </div>

                {snapshot.state === "requires_review" ? (
                  <div className="mx-5 mb-5 rounded-2xl bg-sun/15 p-5 ring-1 ring-sun/35">
                    <p className="font-semibold">No valid votes were recorded.</p>
                    <p className="mt-1 text-sm leading-6 text-ink-soft">
                      Choose an equal split or cancel this allocation. Either choice creates a new revision and preserves this review record.
                    </p>
                    <ZeroVoteReviewControls campaignId={campaignId} snapshotId={snapshot.id} />
                  </div>
                ) : (
                  <div className="divide-y divide-line border-t border-line">
                    {snapshotLines.map((line) => {
                      const organization = organizationById.get(line.organization_id);
                      const donation = donationByLineId.get(line.id);
                      const payment = donation
                        ? paymentByDonationId.get(donation.id)
                        : undefined;
                      const sandboxCurrencySupported =
                        isPayPalSandboxSettlementCurrency(snapshot.currency);
                      const donationReadyForSandbox =
                        donation &&
                        [
                          "approved_for_payment",
                          "payment_failed",
                          "requires_reconciliation",
                        ].includes(donation.status);
                      const canStartSandbox =
                        donationReadyForSandbox &&
                        paypalSandboxReady &&
                        sandboxCurrencySupported;
                      const paymentErrorDetails = payment
                        ? getPayPalErrorDetails(payment.error_details)
                        : [];
                      return (
                        <div key={line.id} className="grid gap-3 p-5 md:grid-cols-[1fr_auto] md:items-start">
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
                              <div className="mt-3 rounded-xl bg-[#edf7ff] p-3 text-xs leading-5 text-ink-soft ring-1 ring-[#0070ba]/15">
                                <p className="font-bold text-[#005ea6]">PayPal Sandbox · {payment.status.replaceAll("_", " ")}</p>
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
                            )}
                            {canStartSandbox && (
                              <PayPalSandboxPayoutForm
                                campaignId={campaignId}
                                donationRecordId={donation.id}
                                isRetry={Boolean(payment)}
                              />
                            )}
                            {donationReadyForSandbox &&
                              paypalSandboxReady &&
                              !sandboxCurrencySupported && (
                                <div className="mt-3 rounded-xl bg-sun/15 p-3 text-xs leading-5 text-ink-soft ring-1 ring-sun/35">
                                  PayPal Sandbox testing currently supports USD campaigns only. This {snapshot.currency} allocation remains available for simulation and manual evidence.
                                </div>
                              )}
                            {donation && donation.environment !== "sandbox" && (
                              <DonationStatusForm
                                campaignId={campaignId}
                                donationRecordId={donation.id}
                                currentStatus={donation.status}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-8 border-t border-line pt-6">
        <div className="flex items-center gap-2">
          <History className="size-5 text-mint-dark" aria-hidden="true" />
          <h3 className="font-semibold">Audit history</h3>
        </div>
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
    </section>
  );
}
