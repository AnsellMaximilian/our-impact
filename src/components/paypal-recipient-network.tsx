import { CheckCircle2, CircleAlert, ExternalLink, ShieldCheck } from "lucide-react";

type RecipientOrganization = {
  id: number;
  name: string;
  category: string;
};

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
  if (!value) return null;
  if (value.length <= 10) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function PayPalRecipientNetwork({
  campaignId,
  organizations,
  connections,
  databaseReady,
  platformReady,
  isAdmin,
}: {
  campaignId: string;
  organizations: RecipientOrganization[];
  connections: MerchantConnection[];
  databaseReady: boolean;
  platformReady: boolean;
  isAdmin: boolean;
}) {
  const connectionByOrganization = new Map(
    connections.map((connection) => [connection.organization_id, connection]),
  );

  return (
    <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">
            PayPal recipient network
          </p>
          <h2 className="mt-2 text-2xl font-semibold">Curate consented payees</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">
            A recipient signs in to PayPal Sandbox once and grants Our Impact permission to create checkout orders for their merchant account. We store the verified merchant ID and consent state—never their PayPal password or API secret.
          </p>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-mint/15 px-3 py-2 text-xs font-bold text-mint-dark ring-1 ring-mint/30">
          <ShieldCheck className="size-4" aria-hidden="true" /> Sandbox curation
        </span>
      </div>

      {!databaseReady && (
        <div className="mt-5 rounded-2xl bg-sun/15 p-4 text-sm font-semibold text-ink ring-1 ring-sun/35">
          Apply the Stage 5 database migration before connecting recipients.
        </div>
      )}
      {databaseReady && !platformReady && (
        <div className="mt-5 rounded-2xl bg-sun/15 p-4 text-sm leading-6 text-ink ring-1 ring-sun/35">
          Add the PayPal partner merchant ID and attribution ID to the deployment before starting recipient consent.
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {organizations.map((organization) => {
          const connection = connectionByOrganization.get(organization.id);
          const active =
            connection?.status === "active" &&
            connection.curation_state === "approved";
          const pending = connection?.status === "pending";
          const canRefresh = Boolean(connection?.merchant_id) && !active;

          return (
            <article
              key={organization.id}
              className="rounded-3xl border border-line bg-white p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">{organization.name}</p>
                  <p className="mt-1 text-xs text-ink-soft">{organization.category}</p>
                </div>
                <span
                  className={
                    active
                      ? "inline-flex items-center gap-1.5 rounded-full bg-mint/15 px-2.5 py-1 text-xs font-bold text-mint-dark"
                      : "inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-bold text-ink-soft"
                  }
                >
                  {active ? (
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  ) : (
                    <CircleAlert className="size-3.5" aria-hidden="true" />
                  )}
                  {active ? "Curated" : pending ? "Consent started" : "Not connected"}
                </span>
              </div>

              {connection?.merchant_id && (
                <dl className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-paper p-3 text-xs">
                  <div>
                    <dt className="text-ink-soft">Merchant</dt>
                    <dd className="mt-1 font-semibold">
                      {maskedMerchantId(connection.merchant_id)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-soft">Can receive</dt>
                    <dd className="mt-1 font-semibold">
                      {connection.payments_receivable ? "Yes" : "Not yet"}
                    </dd>
                  </div>
                </dl>
              )}

              {connection?.last_error_code && !active && (
                <p className="mt-3 text-xs leading-5 text-coral-dark">
                  PayPal status: {connection.last_error_code.replaceAll("_", " ")}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {!active && !canRefresh && (
                  <form action="/api/paypal/onboarding/start" method="post">
                    <input type="hidden" name="campaignId" value={campaignId} />
                    <input
                      type="hidden"
                      name="organizationId"
                      value={organization.id}
                    />
                    <button
                      type="submit"
                      disabled={!databaseReady || !platformReady || !isAdmin}
                      className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/40"
                    >
                      Connect PayPal Sandbox
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </button>
                  </form>
                )}
                {canRefresh && (
                  <form action="/api/paypal/onboarding/refresh" method="post">
                    <input type="hidden" name="campaignId" value={campaignId} />
                    <input
                      type="hidden"
                      name="organizationId"
                      value={organization.id}
                    />
                    <button
                      type="submit"
                      disabled={!platformReady || !isAdmin}
                      className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/40"
                    >
                      Recheck PayPal status
                    </button>
                  </form>
                )}
                {active && (
                  <p className="text-xs leading-5 text-ink-soft">
                    Checkout is enabled for this recipient in published widgets.
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
