import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarClock,
  ExternalLink,
  Info,
  Users,
} from "lucide-react";
import { CampaignControls } from "@/components/campaign-controls";
import { CampaignFundingCheckout } from "@/components/campaign-funding-checkout";
import { CampaignForm } from "@/components/campaign-form";
import { CampaignLedger } from "@/components/campaign-ledger";
import { CampaignOperations } from "@/components/campaign-operations";
import { CampaignWorkspaceTabs } from "@/components/campaign-workspace-tabs";
import { EmbedSnippet } from "@/components/embed-snippet";
import { ImpactReportDrafts } from "@/components/impact-report-drafts";
import { PeriodFinalizationControls } from "@/components/ledger-controls";
import { PayPalRecipientNetwork } from "@/components/paypal-recipient-network";
import { SupporterRewards } from "@/components/supporter-rewards";
import { previewAllocation, type AllocationModel } from "@/lib/allocation";
import { getOpenRouterConfiguration } from "@/lib/ai/openrouter";
import { formatMoney } from "@/lib/money";
import { getPayPalPlatformConfiguration } from "@/lib/paypal/platform";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Manage campaign" };

const modelLabels: Record<string, string> = {
  winner_takes_all: "Winner takes all",
  proportional: "Proportional to votes",
  hybrid: "10% base each + proportional remainder",
};

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

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    published?: string;
    status?: string;
    finalized?: string;
    reviewed?: string;
    donation_status?: string;
    paypal?: string;
    paypal_onboarding?: string;
    impact_report?: string;
    error?: string;
  }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!campaign) notFound();

  const { data: workspaceRecipients } = await supabase
    .from("workspace_recipients")
    .select("organization_id")
    .eq("company_id", campaign.company_id)
    .eq("relationship_state", "active");
  const workspaceRecipientIds = (workspaceRecipients ?? []).map((item) => item.organization_id);

  const [
    organizationsResult,
    slateResult,
    periodsResult,
    resultsResult,
    snapshotsResult,
    linesResult,
    donationsResult,
    paymentTransactionsResult,
    paymentEventsResult,
    auditResult,
    membershipResult,
    impactReportDraftsResult,
    merchantConnectionsResult,
    supporterDonationsResult,
    supporterEntitlementsResult,
    fundingOrdersResult,
  ] = await Promise.all([
    workspaceRecipientIds.length
      ? supabase.from("organizations").select("*").in("id", workspaceRecipientIds).order("name")
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("campaign_organizations")
      .select("organization_id, display_order")
      .eq("campaign_id", campaign.id)
      .order("display_order"),
    supabase
      .from("campaign_periods")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("sequence_number", { ascending: false }),
    campaign.status === "draft"
      ? Promise.resolve({ data: [], error: null })
      : supabase.rpc("get_campaign_vote_results", { p_public_id: campaign.public_id }),
    supabase
      .from("allocation_snapshots")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("allocation_lines")
      .select("*")
      .eq("campaign_id", campaign.id),
    supabase
      .from("donation_records")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payment_transactions")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("payment_events")
      .select("*")
      .eq("company_id", campaign.company_id)
      .order("first_received_at", { ascending: false }),
    supabase
      .from("audit_events")
      .select("*")
      .eq("company_id", campaign.company_id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("memberships")
      .select("role")
      .eq("company_id", campaign.company_id)
      .maybeSingle(),
    supabase
      .from("impact_report_drafts")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("paypal_merchant_connections")
      .select(
        "organization_id, status, curation_state, merchant_id, permissions_granted, payments_receivable, primary_email_confirmed, last_error_code, last_verified_at",
      )
      .order("organization_id"),
    supabase
      .from("donation_sessions")
      .select("id, organization_id, amount_minor, currency, status, created_at")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("supporter_entitlements")
      .select("id, entitlement_key, state, qualifying_count, valid_until")
      .eq("campaign_id", campaign.id),
    supabase
      .from("campaign_funding_orders")
      .select("*")
      .eq("campaign_id", campaign.id)
      .order("created_at", { ascending: false }),
  ]);

  const organizations = organizationsResult.data ?? [];
  const slate = slateResult.data ?? [];
  const periods = periodsResult.data ?? [];
  const voteResults = resultsResult.data ?? [];
  const snapshots = snapshotsResult.data ?? [];
  const allocationLines = linesResult.data ?? [];
  const donationRecords = donationsResult.data ?? [];
  const paymentTransactions = paymentTransactionsResult.data ?? [];
  const paymentTransactionIds = new Set(
    paymentTransactions.map((transaction) => transaction.id),
  );
  const paymentEvents = (paymentEventsResult.data ?? []).filter(
    (event) =>
      event.payment_transaction_id &&
      paymentTransactionIds.has(event.payment_transaction_id),
  );
  const auditEvents = auditResult.data ?? [];
  const paypalPlatform = getPayPalPlatformConfiguration();
  const openRouter = getOpenRouterConfiguration();
  const impactReportDatabaseReady = !impactReportDraftsResult.error;
  const impactReportDrafts = impactReportDraftsResult.data ?? [];
  const isAdmin = ["owner", "admin"].includes(membershipResult.data?.role ?? "");
  const merchantConnections = merchantConnectionsResult.data ?? [];
  const supporterDonations = supporterDonationsResult.data ?? [];
  const supporterEntitlements = supporterEntitlementsResult.data ?? [];
  const fundingOrders = fundingOrdersResult.data ?? [];
  const { data: fundingUnitsData } = fundingOrders.length
    ? await supabase
        .from("campaign_funding_units")
        .select("*")
        .in(
          "funding_order_id",
          fundingOrders.map((order) => order.id),
        )
    : { data: [] };
  const fundingUnits = fundingUnitsData ?? [];
  const organizationById = new Map(organizations.map((item) => [item.id, item]));
  const resultByOrganization = new Map(
    voteResults.map((item) => [item.organization_id, item.vote_count]),
  );
  const allocationInputs = slate.map((item, index) => ({
    organizationId: item.organization_id,
    votes:
      campaign.status === "draft"
        ? [50, 30, 20, 10, 5][index] ?? 1
        : resultByOrganization.get(item.organization_id) ?? 0,
  }));
  const allocation = previewAllocation(
    campaign.allocation_model as AllocationModel,
    campaign.budget_minor,
    allocationInputs,
  );
  const totalVotes = allocationInputs.reduce((sum, item) => sum + item.votes, 0);
  const currentPeriod = periods.find((period) => period.status === "open") ?? null;
  const periodById = new Map(periods.map((period) => [period.id, period]));
  const latestSnapshot = snapshots[0] ?? null;
  const latestClosedPeriod = latestSnapshot ? periodById.get(latestSnapshot.period_id) ?? null : null;
  const eligibleImpactSnapshots = snapshots
    .filter((snapshot) => {
      const period = periodById.get(snapshot.period_id);
      return snapshot.state === "allocated" && period?.status === "closed";
    })
    .map((snapshot) => ({
      id: snapshot.id,
      periodSequence: periodById.get(snapshot.period_id)?.sequence_number ?? 0,
      revision: snapshot.revision,
      createdAt: snapshot.created_at,
    }));
  const siteOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://our-impact.vercel.app").replace(/\/$/, "");
  const publicUrl = `${siteOrigin}/embed/${campaign.public_id}`;
  const selectedRecipientOrganizations = slate.flatMap((item) => {
    const organization = organizationById.get(item.organization_id);
    return organization
      ? [
          {
            id: organization.id,
            name: organization.name,
            category: organization.category,
          },
        ]
      : [];
  });
  const fundingOrderBySnapshot = new Map(
    fundingOrders.map((order) => [order.allocation_snapshot_id, order]),
  );
  const fundingCandidate = snapshots.find((snapshot) => {
    const period = periodById.get(snapshot.period_id);
    const records = donationRecords.filter(
      (record) =>
        record.allocation_snapshot_id === snapshot.id && record.amount_minor > 0,
    );
    return (
      period?.status === "closed" &&
      snapshot.state === "allocated" &&
      (fundingOrderBySnapshot.has(snapshot.id) ||
        (records.length > 0 &&
          records.every((record) =>
            [
              "allocated",
              "approved_for_payment",
              "payment_failed",
              "requires_reconciliation",
            ].includes(record.status),
          )))
    );
  });
  const fundingOrder = fundingCandidate
    ? fundingOrderBySnapshot.get(fundingCandidate.id) ?? null
    : null;
  const fundingDonations = fundingCandidate
    ? donationRecords.filter(
        (record) =>
          record.allocation_snapshot_id === fundingCandidate.id &&
          record.amount_minor > 0,
      )
    : [];
  const fundingUnitByDonation = new Map(
    fundingUnits
      .filter((unit) => unit.funding_order_id === fundingOrder?.id)
      .map((unit) => [unit.donation_record_id, unit]),
  );
  const merchantConnectionByOrganization = new Map(
    merchantConnections
      .filter(
        (connection) =>
          connection.status === "active" &&
          connection.curation_state === "approved" &&
          connection.permissions_granted &&
          connection.payments_receivable &&
          connection.primary_email_confirmed &&
          connection.merchant_id,
      )
      .map((connection) => [connection.organization_id, connection]),
  );
  const fundingMerchantIds = fundingDonations.flatMap((record) => {
    const merchantId = merchantConnectionByOrganization.get(
      record.organization_id,
    )?.merchant_id;
    return merchantId ? [merchantId] : [];
  });
  const latestRoundDonations = latestSnapshot
    ? donationRecords.filter(
        (record) =>
          record.allocation_snapshot_id === latestSnapshot.id &&
          record.amount_minor > 0,
      )
    : [];
  const latestRoundReadyRecipients = latestRoundDonations.filter((record) =>
    merchantConnectionByOrganization.has(record.organization_id),
  ).length;
  const fundingRoundSequence = fundingCandidate
    ? periodById.get(fundingCandidate.period_id)?.sequence_number ?? null
    : null;
  const fundingBadge = fundingRoundSequence
    ? fundingOrder?.status === "completed"
      ? `Round ${fundingRoundSequence} funded`
      : `Round ${fundingRoundSequence} ready`
    : null;

  return (
    <main className="mx-auto max-w-[90rem] px-5 py-10 sm:px-8 sm:py-14">
      <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full py-2 text-sm font-semibold text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to dashboard
      </Link>

      {(query.saved === "1" || query.published === "1" || query.status || query.finalized === "1" || query.reviewed || query.donation_status || query.paypal === "submitted" || query.paypal === "already_reserved" || query.impact_report) && (
        <div className="mt-6 rounded-2xl bg-mint/15 px-5 py-4 text-sm font-semibold text-mint-dark ring-1 ring-mint/35" role="status">
          {query.saved === "1" && "Draft changes saved."}
          {query.published === "1" && "Campaign published. Public voting is now open."}
          {query.status === "paused" && "Public voting is paused."}
          {query.status === "published" && "Public voting resumed."}
          {query.finalized === "1" && "Voting ended and the recipient amounts are ready to fund."}
          {query.reviewed === "equal_split" && "Zero-vote review resolved with a new equal-split revision."}
          {query.reviewed === "canceled" && "The round’s zero-vote allocation was canceled."}
          {query.donation_status && "Donation evidence status recorded in the audit history."}
          {query.paypal === "submitted" && "PayPal accepted the previous payment request. Its status will update here."}
          {query.paypal === "already_reserved" && "That previous payment request is already being handled."}
          {query.impact_report === "generated" && "A source-grounded impact-report draft was generated and is waiting for human review."}
          {query.impact_report === "approved" && "The impact-report draft was marked as human approved. Nothing was published automatically."}
          {query.impact_report === "draft" && "The impact-report draft was returned to review."}
        </div>
      )}
      {(query.paypal === "rejected" || query.paypal === "uncertain" || query.paypal === "unsupported_currency") && (
        <div className="mt-6 rounded-2xl bg-sun/15 px-5 py-4 text-sm font-semibold text-ink ring-1 ring-sun/35" role="status">
          {query.paypal === "rejected"
            ? "PayPal rejected the previous payment request. Review the account before trying again."
            : query.paypal === "unsupported_currency"
              ? "Campaign funding currently supports USD only. No payment request was created."
              : "PayPal is still confirming the previous payment. Wait for its status before trying again."}
        </div>
      )}
      {query.error && (
        <div className="mt-6 rounded-2xl bg-coral/10 px-5 py-4 text-sm font-semibold text-coral-dark ring-1 ring-coral/25" role="alert">
          {query.error}
        </div>
      )}
      {query.paypal_onboarding && (
        <div
          className={`mt-6 rounded-2xl px-5 py-4 text-sm font-semibold ring-1 ${
            ["connected", "already_connected"].includes(
              query.paypal_onboarding,
            )
              ? "bg-mint/15 text-mint-dark ring-mint/35"
              : "bg-sun/15 text-ink ring-sun/35"
          }`}
          role="status"
        >
          {query.paypal_onboarding === "connected" &&
            "PayPal verified this sandbox merchant and added it to the curated recipient network."}
          {query.paypal_onboarding === "already_connected" &&
            "This recipient is already verified and curated for PayPal Sandbox checkout."}
          {query.paypal_onboarding === "incomplete" &&
            "PayPal consent returned, but the merchant setup is not ready to receive checkout payments yet. Check the sandbox business account, then recheck its status."}
          {query.paypal_onboarding === "verification_failed" &&
            "Our Impact could not verify the merchant directly with PayPal. Check the partner settings and recheck the status."}
          {query.paypal_onboarding === "paypal_error" &&
            "PayPal could not start recipient onboarding. Check the partner merchant ID and attribution ID."}
          {["invalid", "invalid_callback", "unknown_connection", "not_started"].includes(
            query.paypal_onboarding,
          ) && "The recipient connection could not be found or validated."}
          {query.paypal_onboarding === "forbidden" &&
            "Owner or admin access is required to manage recipient consent."}
          {query.paypal_onboarding === "database_error" &&
            "The recipient connection could not be saved. Please try again or contact support."}
        </div>
      )}

      <section className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="inline-flex rounded-full bg-sun/25 px-3 py-1.5 text-xs font-bold capitalize text-ink">
            {campaign.status}
          </span>
          <h1 className="display-type mt-4 text-4xl font-semibold sm:text-6xl">{campaign.title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-ink-soft">{campaign.summary}</p>
        </div>
        <CampaignControls campaignId={campaign.id} status={campaign.status} />
      </section>

      {campaign.status === "draft" ? (
        <div className="mt-10">
          <CampaignForm
            organizations={organizations}
            campaign={campaign}
            selectedOrganizationIds={slate.map((item) => item.organization_id)}
          />
          <div className="mt-6 rounded-2xl bg-sun/15 p-5 text-sm leading-6 text-ink-soft ring-1 ring-sun/35">
            Save any changes before publishing. Publishing starts the first voting round with these settings.
          </div>
          <div className="mt-6">
            <CampaignControls campaignId={campaign.id} status={campaign.status} />
          </div>
        </div>
      ) : (
        <CampaignWorkspaceTabs
          fundingBadge={fundingBadge}
          overview={
            <div className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">Current period</p>
                <h2 className="mt-2 text-2xl font-semibold">Voting and allocation preview</h2>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ink/5 px-3 py-2 text-sm font-semibold capitalize text-ink-soft">
                <Activity className="size-4 text-mint-dark" aria-hidden="true" /> {currentPeriod?.status ?? "not started"}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-ink p-5 text-white">
                <Users className="size-5 text-mint" aria-hidden="true" />
                <p className="mt-4 text-3xl font-semibold">{totalVotes}</p>
                <p className="text-sm text-white/65">accepted votes</p>
              </div>
              <div className="rounded-2xl bg-paper p-5 ring-1 ring-ink/8">
                <BarChart3 className="size-5 text-coral-dark" aria-hidden="true" />
                <p className="mt-4 text-lg font-semibold">{modelLabels[campaign.allocation_model]}</p>
                <p className="text-sm text-ink-soft">allocation model</p>
              </div>
              <div className="rounded-2xl bg-paper p-5 ring-1 ring-ink/8">
                <CalendarClock className="size-5 text-mint-dark" aria-hidden="true" />
                <p className="mt-4 text-sm font-semibold">
                  {currentPeriod ? formatDate(currentPeriod.closes_at, campaign.timezone) : "Not scheduled"}
                </p>
                <p className="text-sm text-ink-soft">period closes</p>
              </div>
            </div>

            <div className="mt-7 space-y-3">
              {allocation.lines.map((line) => {
                const organization = organizationById.get(line.organizationId);
                const percentage = totalVotes ? Math.round((line.votes / totalVotes) * 100) : 0;
                return (
                  <div key={line.organizationId} className="rounded-2xl border border-line bg-white p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">{organization?.name ?? "Organization"}</p>
                        <p className="mt-1 text-xs text-ink-soft">{line.votes} votes · {percentage}%</p>
                      </div>
                      <p className="font-semibold">{formatMoney(line.amountMinor, campaign.currency)}</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/8">
                      <div className="h-full rounded-full bg-mint-dark" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {allocation.requiresReview && (
              <div className="mt-5 flex gap-3 rounded-2xl bg-sun/15 p-4 text-sm leading-6 text-ink-soft ring-1 ring-sun/35">
                <Info className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden="true" />
                No votes yet, so the commitment remains unallocated and needs your review.
              </div>
            )}
            {currentPeriod && (
              <PeriodFinalizationControls
                campaignId={campaign.id}
                periodId={currentPeriod.id}
              />
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-[2rem] bg-ink p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint">Public widget</p>
              <p className="mt-3 text-sm leading-6 text-white/70">Share the direct link or embed the same voting experience on another website.</p>
              <Link href={publicUrl} target="_blank" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-mint">
                Open public campaign <ExternalLink className="size-4" aria-hidden="true" />
              </Link>
            </section>
            <EmbedSnippet publicUrl={publicUrl} />
            <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8">
              <p className="text-sm font-semibold">Campaign rules</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-ink-soft">Commitment</dt><dd className="font-semibold">{formatMoney(campaign.budget_minor, campaign.currency)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-soft">Cadence</dt><dd className="font-semibold capitalize">{campaign.period_cadence}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-soft">Time zone</dt><dd className="font-semibold">{campaign.timezone}</dd></div>
              </dl>
            </section>
          </aside>
          </div>

          <CampaignOperations
            currency={campaign.currency}
            currentPeriodSequence={currentPeriod?.sequence_number ?? null}
            latestClosedPeriodSequence={latestClosedPeriod?.sequence_number ?? null}
            latestSnapshot={latestSnapshot ? {
              period_id: latestSnapshot.period_id,
              state: latestSnapshot.state,
              allocated_minor: latestSnapshot.allocated_minor,
              unallocated_minor: latestSnapshot.unallocated_minor,
            } : null}
            donationRecords={donationRecords.map((record) => ({
              id: record.id,
              period_id: record.period_id,
              status: record.status,
            }))}
            paymentTransactions={paymentTransactions.map((transaction) => ({
              donation_record_id: transaction.donation_record_id,
              status: transaction.status,
            }))}
            readyRecipientCount={latestRoundReadyRecipients}
            recipientCount={latestRoundDonations.length}
          />
            </div>
          }
          rounds={
            <div className="space-y-6">
          {fundingCandidate && (
            <CampaignFundingCheckout
              campaignId={campaign.id}
              snapshotId={fundingCandidate.id}
              periodSequence={
                periodById.get(fundingCandidate.period_id)?.sequence_number ?? 0
              }
              totalMinor={fundingCandidate.allocated_minor}
              currency={fundingCandidate.currency}
              fundingStatus={fundingOrder?.status ?? null}
              merchantIds={fundingMerchantIds}
              clientId={paypalPlatform.clientId}
              attributionId={paypalPlatform.attributionId}
              units={fundingDonations.map((record) => {
                const unit = fundingUnitByDonation.get(record.id);
                return {
                  id: unit?.id ?? record.id,
                  organizationName:
                    organizationById.get(record.organization_id)?.name ??
                    "Community recipient",
                  amountMinor: record.amount_minor,
                  status: unit?.status ?? "ready",
                };
              })}
            />
          )}
              {!fundingCandidate && (
                <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">
                    Community funding
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">No round is waiting for payment</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">
                    The next PayPal checkout will appear here after a voting round closes and its recipients are ready.
                  </p>
                </section>
              )}
              <CampaignLedger
                campaignId={campaign.id}
                timezone={campaign.timezone}
                periods={periods}
                snapshots={snapshots}
                lines={allocationLines}
                donationRecords={donationRecords}
                paymentTransactions={paymentTransactions}
                paymentEvents={paymentEvents}
                auditEvents={auditEvents}
                organizations={organizations}
              />
            </div>
          }
          recipients={
            <PayPalRecipientNetwork
            organizations={selectedRecipientOrganizations}
            connections={merchantConnections}
            databaseReady={!merchantConnectionsResult.error}
          />
          }
          supporters={
            <SupporterRewards
            donations={supporterDonations}
            entitlements={supporterEntitlements}
            organizationNames={new Map(
              organizations.map((organization) => [organization.id, organization.name]),
            )}
            databaseReady={
              !supporterDonationsResult.error &&
              !supporterEntitlementsResult.error
            }
          />
          }
          reports={
            <ImpactReportDrafts
            campaignId={campaign.id}
            timezone={campaign.timezone}
            databaseReady={impactReportDatabaseReady}
            openRouterReady={openRouter.ready}
            configuredModel={openRouter.model}
            isAdmin={isAdmin}
            eligibleSnapshots={eligibleImpactSnapshots}
            drafts={impactReportDrafts}
          />
          }
        />
      )}
    </main>
  );
}
