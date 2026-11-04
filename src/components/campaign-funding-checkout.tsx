"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  HeartHandshake,
  LockKeyhole,
} from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { PayPalButtonsInstance } from "@/lib/paypal/client";

type FundingUnit = {
  id: string;
  organizationName: string;
  amountMinor: number;
  status: string;
};

const completedStatuses = new Set(["completed"]);
const blockedStatuses = new Set([
  "capturing",
  "partially_completed",
  "requires_reconciliation",
]);

export function CampaignFundingCheckout({
  campaignId,
  snapshotId,
  periodSequence,
  totalMinor,
  currency,
  fundingStatus,
  units,
  merchantIds,
  clientId,
  attributionId,
}: {
  campaignId: string;
  snapshotId: string;
  periodSequence: number;
  totalMinor: number;
  currency: string;
  fundingStatus: string | null;
  units: FundingUnit[];
  merchantIds: string[];
  clientId: string | null;
  attributionId: string | null;
}) {
  const router = useRouter();
  const rawId = useId();
  const containerId = `campaign-funding-${rawId.replaceAll(":", "")}`;
  const buttonsRef = useRef<PayPalButtonsInstance | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(
    completedStatuses.has(fundingStatus ?? ""),
  );
  const ready = Boolean(
    clientId && attributionId && merchantIds.length === units.length,
  );
  const blocked = blockedStatuses.has(fundingStatus ?? "");
  const sdkUrl = clientId
    ? `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&merchant-id=*&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons`
    : "";

  useEffect(() => {
    if (!sdkReady || !window.paypal || !ready || blocked || completed) return;
    const container = document.getElementById(containerId);
    if (!container) return;

    let disposed = false;
    container.replaceChildren();
    const buttons = window.paypal.Buttons({
      style: {
        layout: "vertical",
        shape: "pill",
        label: "paypal",
        tagline: false,
      },
      async createOrder() {
        setBusy(true);
        setMessage(null);
        const response = await fetch(
          `/api/dashboard/campaigns/${encodeURIComponent(campaignId)}/funding/orders`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ snapshotId }),
          },
        );
        const result = (await response.json()) as {
          id?: string;
          message?: string;
        };
        setBusy(false);
        if (!response.ok || !result.id) {
          setMessage(result.message ?? "PayPal checkout could not be started.");
          throw new Error("create_funding_order_failed");
        }
        return result.id;
      },
      async onApprove(data, actions) {
        setBusy(true);
        setMessage("Confirming your payment with PayPal…");
        const response = await fetch(
          `/api/dashboard/campaigns/${encodeURIComponent(campaignId)}/funding/orders/${encodeURIComponent(data.orderID)}/capture`,
          { method: "POST" },
        );
        const result = (await response.json()) as {
          message?: string;
          restart?: boolean;
          status?: string;
        };
        setBusy(false);

        if (result.restart) {
          setMessage(result.message ?? "Choose another payment method.");
          await actions.restart();
          return;
        }

        setMessage(
          result.message ??
            (response.ok
              ? "Payment confirmed."
              : "This payment could not be confirmed."),
        );
        if (response.ok) {
          setCompleted(result.status === "completed");
          router.refresh();
        }
      },
      onCancel() {
        setBusy(false);
        setMessage("Checkout canceled. No new payment was recorded.");
      },
      onError() {
        setBusy(false);
        setMessage((current) => current ?? "PayPal checkout encountered an error.");
      },
    });
    buttonsRef.current = buttons;
    void buttons.render(container).catch(() => {
      if (!disposed) setMessage("PayPal buttons could not be loaded.");
    });

    return () => {
      disposed = true;
      const current = buttonsRef.current;
      buttonsRef.current = null;
      if (current?.close) void current.close().catch(() => undefined);
      container.replaceChildren();
    };
  }, [
    blocked,
    campaignId,
    completed,
    containerId,
    ready,
    router,
    sdkReady,
    snapshotId,
  ]);

  return (
    <section
      id="campaign-funding"
      className="scroll-mt-24 overflow-hidden rounded-[2rem] bg-surface ring-1 ring-ink/8"
    >
      {ready && !completed && !blocked && (
        <Script
          id={`paypal-campaign-funding-${snapshotId}`}
          src={sdkUrl}
          strategy="afterInteractive"
          data-partner-attribution-id={attributionId ?? undefined}
          data-merchant-id={merchantIds.join(",")}
          onLoad={() => setSdkReady(true)}
          onError={() => setMessage("PayPal checkout could not be loaded.")}
        />
      )}

      <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">
            Community funding · Round {periodSequence}
          </p>
          <h2 className="mt-2 text-3xl font-semibold">
            {completed ? "This round is funded" : "Fund the community’s choices"}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
            {completed
              ? "PayPal confirmed the recipient payments and the campaign history is up to date."
              : `Approve ${formatMoney(totalMinor, currency)} in PayPal. The total is sent directly to the selected recipients below.`}
          </p>

          <div className="mt-6 divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
            {units.map((unit) => (
              <div
                key={unit.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-full bg-mint/15 text-mint-dark">
                    {unit.status === "completed" ? (
                      <CheckCircle2 className="size-4" aria-hidden="true" />
                    ) : (
                      <HeartHandshake className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{unit.organizationName}</p>
                    <p className="text-xs text-ink-soft">
                      {unit.status === "completed" ? "Paid" : "Ready to receive"}
                    </p>
                  </div>
                </div>
                <p className="font-semibold">
                  {formatMoney(unit.amountMinor, currency)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-paper p-6 sm:p-8">
          {completed ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
              <span className="grid size-14 place-items-center rounded-full bg-mint/15 text-mint-dark">
                <CheckCircle2 className="size-7" aria-hidden="true" />
              </span>
              <p className="mt-4 text-lg font-semibold">Payment complete</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Each recipient has its own recorded PayPal result.
              </p>
            </div>
          ) : blocked ? (
            <div className="flex gap-3 rounded-2xl bg-sun/20 p-4 text-sm leading-6 ring-1 ring-sun/35">
              <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p>
                {fundingStatus === "partially_completed"
                  ? "PayPal completed some recipient payments. Review the payment history before taking another action."
                  : "PayPal is still confirming this payment. Wait for the status to update before trying again."}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm leading-6 text-ink-soft ring-1 ring-ink/8">
                <LockKeyhole className="mt-0.5 size-5 shrink-0 text-mint-dark" aria-hidden="true" />
                <p>
                  You’ll sign in and approve the payment in PayPal. Our Impact does not receive your password or payment details.
                </p>
              </div>
              {ready ? (
                <div className="relative mt-5 min-h-12">
                  <div
                    id={containerId}
                    className={busy ? "pointer-events-none opacity-60" : ""}
                  />
                </div>
              ) : (
                <div className="mt-5 rounded-2xl bg-sun/20 p-4 text-sm font-semibold ring-1 ring-sun/35">
                  PayPal checkout will appear once every recipient is ready.
                </div>
              )}
            </>
          )}

          {message && (
            <p className="mt-4 text-sm font-semibold leading-6" aria-live="polite">
              {message}
            </p>
          )}
          {!completed && (
            <p className="mt-5 text-center text-xs text-ink-soft">
              Sandbox checkout · no live funds
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
