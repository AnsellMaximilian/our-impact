import "server-only";

import { ingestDeveloperEvent, listSupporterEntitlements } from "@/lib/developer/events";
import { deliverDeveloperWebhooks } from "@/lib/developer/webhooks";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

export async function recordPayPalDonationDeveloperEvent(
  donationSessionId: string,
) {
  const privileged = createPrivilegedClient();
  const { data: donation } = await privileged
    .from("donation_sessions")
    .select(
      "id, public_reference, company_id, campaign_id, organization_id, developer_project_id, supporter_id, developer_event_id, amount_minor, currency, status, paypal_capture_id, completed_at",
    )
    .eq("id", donationSessionId)
    .maybeSingle();

  if (
    !donation ||
    donation.status !== "completed" ||
    !donation.paypal_capture_id ||
    !donation.completed_at ||
    !donation.developer_project_id ||
    !donation.supporter_id
  ) {
    return null;
  }

  const [projectResult, supporterResult, campaignResult, organizationResult] =
    await Promise.all([
      privileged
        .from("developer_projects")
        .select("*")
        .eq("id", donation.developer_project_id)
        .eq("company_id", donation.company_id)
        .maybeSingle(),
      privileged
        .from("supporters")
        .select("id, external_user_id, display_name")
        .eq("id", donation.supporter_id)
        .eq("project_id", donation.developer_project_id)
        .eq("company_id", donation.company_id)
        .maybeSingle(),
      privileged
        .from("campaigns")
        .select("public_id, title")
        .eq("id", donation.campaign_id)
        .maybeSingle(),
      privileged
        .from("organizations")
        .select("name")
        .eq("id", donation.organization_id)
        .maybeSingle(),
    ]);

  const project = projectResult.data;
  const supporter = supporterResult.data;
  if (!project || !supporter) return null;

  const result = await ingestDeveloperEvent({
    project,
    externalUserId: supporter.external_user_id,
    displayName: supporter.display_name ?? undefined,
    externalEventId: `paypal_capture:${donation.paypal_capture_id}`,
    eventType: "donation.completed",
    occurredAt: donation.completed_at,
    source: "paypal",
    properties: {
      amount: (donation.amount_minor / 100).toFixed(2),
      amount_minor: donation.amount_minor,
      currency: donation.currency,
      campaign_id: donation.campaign_id,
      campaign_public_id: campaignResult.data?.public_id,
      campaign_title: campaignResult.data?.title,
      organization_id: donation.organization_id,
      recipient: organizationResult.data?.name,
      donation_reference: donation.public_reference,
      paypal_capture_id: donation.paypal_capture_id,
      source: "widget",
    },
  });

  if (donation.developer_event_id !== result.event.id) {
    const { error } = await privileged
      .from("donation_sessions")
      .update({ developer_event_id: result.event.id })
      .eq("id", donation.id)
      .is("developer_event_id", null);
    if (error) {
      console.error("donation_developer_event_link_failed", {
        code: error.code,
        donationSessionId: donation.id,
        developerEventId: result.event.id,
      });
    }
  }

  const entitlements = await listSupporterEntitlements(project.id, supporter.id);
  await deliverDeveloperWebhooks({ projectId: project.id, limit: 10 }).catch(
    (error) => {
      console.error("donation_developer_webhook_delivery_failed", {
        donationSessionId: donation.id,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    },
  );

  return {
    externalUserId: supporter.external_user_id,
    replayed: result.replayed,
    entitlements: entitlements.map((entitlement) => ({
      key: entitlement.entitlement_key,
      state: entitlement.state,
      qualifyingCount: entitlement.qualifying_count,
    })),
  };
}
