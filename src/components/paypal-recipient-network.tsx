import Link from "next/link";
import { CheckCircle2, CircleAlert, ExternalLink, ShieldCheck } from "lucide-react";

type RecipientOrganization = { id: number; name: string; category: string };
type MerchantConnection = {
  organization_id: number;
  status: string;
  curation_state: string;
  merchant_id: string | null;
  payments_receivable: boolean;
  primary_email_confirmed: boolean;
  last_error_code: string | null;
  last_verified_at: string | null;
};

function maskedMerchantId(value: string | null) {
  if (!value || value.length <= 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function PayPalRecipientNetwork({
  organizations,
  connections,
  databaseReady,
}: {
  organizations: RecipientOrganization[];
  connections: MerchantConnection[];
  databaseReady: boolean;
}) {
  const byOrganization = new Map(
    connections.map((connection) => [connection.organization_id, connection]),
  );

  return (
    <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">
            Recipient readiness
          </p>
          <h2 className="mt-2 text-2xl font-semibold">PayPal consent belongs to each recipient</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
            This campaign can only send checkout funds to organizations that accepted a private invitation. Mike’s team can see readiness here, but cannot connect PayPal for them.
          </p>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-mint/15 px-3 py-2 text-xs font-bold text-mint-dark ring-1 ring-mint/30">
          <ShieldCheck className="size-4" aria-hidden="true" /> Recipient controlled
        </span>
      </div>

      {!databaseReady && (
        <div className="mt-5 rounded-2xl bg-sun/15 p-4 text-sm font-semibold text-ink ring-1 ring-sun/35">
          Recipient readiness is temporarily unavailable. Please refresh shortly.
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {organizations.map((organization) => {
          const connection = byOrganization.get(organization.id);
          const active = connection?.status === "active" && connection.curation_state === "approved";
          return (
            <article key={organization.id} className="rounded-3xl border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{organization.name}</p>
                  <p className="mt-1 text-xs text-ink-soft">{organization.category}</p>
                </div>
                <span className={active
                  ? "inline-flex items-center gap-1.5 rounded-full bg-mint/15 px-2.5 py-1 text-xs font-bold text-mint-dark"
                  : "inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-bold text-ink-soft"}
                >
                  {active ? <CheckCircle2 className="size-3.5" /> : <CircleAlert className="size-3.5" />}
                  {active ? "PayPal ready" : "Invitation required"}
                </span>
              </div>
              {connection?.merchant_id && (
                <p className="mt-4 rounded-2xl bg-paper p-3 text-xs text-ink-soft">
                  Verified merchant <span className="font-semibold text-ink">{maskedMerchantId(connection.merchant_id)}</span>
                </p>
              )}
              {connection?.last_error_code && !active && (
                <p className="mt-3 text-xs text-coral-dark">
                  PayPal status: {connection.last_error_code.replaceAll("_", " ")}
                </p>
              )}
            </article>
          );
        })}
      </div>

      <Link
        href="/dashboard/organizations"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/90"
      >
        Manage recipient invitations <ExternalLink className="size-3.5" aria-hidden="true" />
      </Link>
    </section>
  );
}
