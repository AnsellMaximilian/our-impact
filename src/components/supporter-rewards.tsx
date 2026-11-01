import { BadgeCheck, Gift, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/money";

type DonationSession = {
  id: string;
  organization_id: number;
  amount_minor: number;
  currency: string;
  status: string;
  created_at: string;
};

type Entitlement = {
  id: string;
  entitlement_key: string;
  state: string;
  qualifying_count: number;
  valid_until: string | null;
};

export function SupporterRewards({
  donations,
  entitlements,
  organizationNames,
  databaseReady,
}: {
  donations: DonationSession[];
  entitlements: Entitlement[];
  organizationNames: Map<number, string>;
  databaseReady: boolean;
}) {
  const completed = donations.filter((donation) => donation.status === "completed");
  const activeSupporters = entitlements.filter(
    (entitlement) =>
      entitlement.entitlement_key === "supporter" &&
      entitlement.state === "active",
  ).length;
  const activeTierThree = entitlements.filter(
    (entitlement) =>
      entitlement.entitlement_key === "tier_3" &&
      entitlement.state === "active",
  ).length;

  return (
    <section className="rounded-[2rem] bg-ink p-6 text-white sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-mint">
            Supporter policy engine
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Verified actions become roles</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
            The sandbox baseline evaluates deterministic policies after a verified capture or reversal. It does not ask AI to decide who earned a role.
          </p>
        </div>
        <code className="w-fit rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80">
          Target SDK: OurImpact.user.is(&quot;tier_3&quot;)
        </code>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
          <Gift className="size-5 text-mint" aria-hidden="true" />
          <p className="mt-3 text-2xl font-semibold">{completed.length}</p>
          <p className="text-sm text-white/55">completed captures</p>
        </div>
        <div className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
          <BadgeCheck className="size-5 text-sun" aria-hidden="true" />
          <p className="mt-3 text-2xl font-semibold">{activeSupporters}</p>
          <p className="text-sm text-white/55">active supporters</p>
        </div>
        <div className="rounded-2xl bg-white/8 p-4 ring-1 ring-white/10">
          <Sparkles className="size-5 text-coral" aria-hidden="true" />
          <p className="mt-3 text-2xl font-semibold">{activeTierThree}</p>
          <p className="text-sm text-white/55">Tier 3 identities</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="rounded-2xl bg-white/8 p-5 ring-1 ring-white/10">
          <p className="text-sm font-semibold">Active baseline policies</p>
          <ul className="mt-3 space-y-3 text-sm leading-6 text-white/65">
            <li>
              <strong className="text-white">supporter:</strong> at least one completed contribution in this campaign.
            </li>
            <li>
              <strong className="text-white">tier_3:</strong> at least three completed contributions in the campaign’s calendar month.
            </li>
            <li>Refunds and reversals recalculate both roles automatically.</li>
          </ul>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white/8 ring-1 ring-white/10">
          <div className="border-b border-white/10 px-5 py-4">
            <p className="text-sm font-semibold">Recent supporter checkout</p>
          </div>
          {!databaseReady ? (
            <p className="p-5 text-sm text-white/60">Apply the Stage 5 migration to load checkout activity.</p>
          ) : donations.length === 0 ? (
            <p className="p-5 text-sm text-white/60">No sandbox supporter orders yet.</p>
          ) : (
            <div className="divide-y divide-white/10">
              {donations.slice(0, 8).map((donation) => (
                <div
                  key={donation.id}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">
                      {organizationNames.get(donation.organization_id) ?? "Recipient"}
                    </p>
                    <p className="mt-0.5 text-xs capitalize text-white/50">
                      {donation.status.replaceAll("_", " ")}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatMoney(donation.amount_minor, donation.currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
