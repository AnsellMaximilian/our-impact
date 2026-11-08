export type LifetimeSnapshot = {
  period_id: string;
  revision: number;
  budget_minor: number;
  allocated_minor: number;
};

export type LifetimeDonation = {
  organization_id: number;
  amount_minor: number;
  environment: string;
};

export type CampaignLifetimeTotals = {
  committedMinor: number;
  allocatedMinor: number;
  paidMinor: number;
  livePaidMinor: number;
  sandboxPaidMinor: number;
  completedPeriods: number;
  paymentCount: number;
  recipientPayments: Array<{
    organizationId: number;
    paidMinor: number;
    paymentCount: number;
  }>;
};

export function calculateCampaignLifetimeTotals(
  snapshots: LifetimeSnapshot[],
  donations: LifetimeDonation[],
): CampaignLifetimeTotals {
  const latestByPeriod = new Map<string, LifetimeSnapshot>();
  for (const snapshot of snapshots) {
    const current = latestByPeriod.get(snapshot.period_id);
    if (!current || snapshot.revision > current.revision) {
      latestByPeriod.set(snapshot.period_id, snapshot);
    }
  }

  const recipientPayments = new Map<number, { paidMinor: number; paymentCount: number }>();
  for (const donation of donations) {
    const current = recipientPayments.get(donation.organization_id) ?? {
      paidMinor: 0,
      paymentCount: 0,
    };
    current.paidMinor += donation.amount_minor;
    current.paymentCount += 1;
    recipientPayments.set(donation.organization_id, current);
  }

  return {
    committedMinor: [...latestByPeriod.values()].reduce((sum, item) => sum + item.budget_minor, 0),
    allocatedMinor: [...latestByPeriod.values()].reduce((sum, item) => sum + item.allocated_minor, 0),
    paidMinor: donations.reduce((sum, item) => sum + item.amount_minor, 0),
    livePaidMinor: donations.filter((item) => item.environment === "live").reduce((sum, item) => sum + item.amount_minor, 0),
    sandboxPaidMinor: donations.filter((item) => item.environment === "sandbox").reduce((sum, item) => sum + item.amount_minor, 0),
    completedPeriods: latestByPeriod.size,
    paymentCount: donations.length,
    recipientPayments: [...recipientPayments].map(([organizationId, totals]) => ({
      organizationId,
      ...totals,
    })),
  };
}
