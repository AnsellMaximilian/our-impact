import { CheckCircle2, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";

export function RecipientPayPalConnect({
  invitationToken,
  platformReady,
  connection,
}: {
  invitationToken: string;
  platformReady: boolean;
  connection: {
    status: string;
    curation_state: string;
    merchant_id: string | null;
    payments_receivable: boolean;
    last_error_code: string | null;
  } | null;
}) {
  const active = connection?.status === "active" && connection.curation_state === "approved";
  const canRefresh = Boolean(connection?.merchant_id) && !active;

  if (active) {
    return (
      <div className="rounded-3xl bg-mint/12 p-6 ring-1 ring-mint/30">
        <p className="flex items-center gap-2 font-semibold text-mint-dark">
          <CheckCircle2 className="size-5" aria-hidden="true" /> PayPal connection ready
        </p>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          Our Impact verified that this sandbox merchant can receive payments. The program owner can see the ready status, but cannot access this PayPal account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl bg-mint/10 p-4 text-sm leading-6 text-ink-soft ring-1 ring-mint/25">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-mint-dark" aria-hidden="true" />
        <p>PayPal handles sign-in and consent. Our Impact stores the verified merchant status, never the recipient’s password or API secret.</p>
      </div>
      {!platformReady && (
        <p className="rounded-2xl bg-sun/15 p-4 text-sm font-semibold ring-1 ring-sun/35">
          The PayPal Sandbox partner configuration is not available in this deployment.
        </p>
      )}
      {connection?.last_error_code && (
        <p className="text-sm font-semibold text-coral-dark">
          PayPal status: {connection.last_error_code.replaceAll("_", " ")}
        </p>
      )}
      <form
        action={canRefresh ? "/api/paypal/onboarding/refresh" : "/api/paypal/onboarding/start"}
        method="post"
      >
        <input type="hidden" name="inviteToken" value={invitationToken} />
        <button
          type="submit"
          disabled={!platformReady}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-ink/10 disabled:text-ink/40"
        >
          {canRefresh ? (
            <><RefreshCw className="size-4" /> Recheck PayPal status</>
          ) : (
            <>Connect PayPal Sandbox <ExternalLink className="size-4" /></>
          )}
        </button>
      </form>
    </div>
  );
}
