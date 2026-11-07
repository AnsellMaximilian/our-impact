"use client";

import Script from "next/script";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckCircle2, LockKeyhole, Sparkles } from "lucide-react";
import Link from "next/link";
import type { PayPalButtonsInstance } from "@/lib/paypal/client";

type Entitlement = {
  key: string;
  state: string;
  qualifyingCount: number;
};

export function PayPalDonate({
  publicId,
  organizationId,
  organizationName,
  merchantId,
  clientId,
  attributionId,
}: {
  publicId: string;
  organizationId: number;
  organizationName: string;
  merchantId: string;
  clientId: string;
  attributionId: string;
}) {
  const rawId = useId();
  const containerId = `paypal-buttons-${rawId.replaceAll(":", "")}`;
  const buttonsRef = useRef<PayPalButtonsInstance | null>(null);
  const [amount, setAmount] = useState("5.00");
  const [sdkReady, setSdkReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const amountMinor = useMemo(() => {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }, [amount]);
  const validAmount = amountMinor >= 100 && amountMinor <= 100000;
  const sdkUrl = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&merchant-id=${encodeURIComponent(merchantId)}&currency=USD&intent=capture&components=buttons`;

  useEffect(() => {
    if (!sdkReady || !window.paypal || !validAmount || completed) return;
    const container = document.getElementById(containerId);
    if (!container) return;

    let disposed = false;
    container.replaceChildren();
    const buttons = window.paypal.Buttons({
      style: { layout: "vertical", shape: "pill", label: "donate" },
      async createOrder() {
        setBusy(true);
        setMessage(null);
        const response = await fetch(
          `/api/campaigns/${encodeURIComponent(publicId)}/donations/orders`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId, amountMinor }),
          },
        );
        const result = (await response.json()) as {
          id?: string;
          message?: string;
        };
        setBusy(false);
        if (!response.ok || !result.id) {
          setMessage(result.message ?? "PayPal checkout could not be started.");
          throw new Error("create_order_failed");
        }
        return result.id;
      },
      async onApprove(data) {
        setBusy(true);
        setMessage("PayPal approved the order. Confirming the sandbox capture…");
        const response = await fetch(
          `/api/campaigns/${encodeURIComponent(publicId)}/donations/orders/${encodeURIComponent(data.orderID)}/capture`,
          { method: "POST" },
        );
        const result = (await response.json()) as {
          message?: string;
          entitlements?: Entitlement[];
          externalUserId?: string;
        };
        setBusy(false);
        setMessage(
          result.message ??
            (response.ok
              ? "Sandbox contribution completed."
              : "The sandbox capture could not be confirmed."),
        );
        if (response.ok) {
          setEntitlements(result.entitlements ?? []);
          setCompleted(true);
          window.parent.postMessage(
            { type: "our-impact.donation-completed" },
            "*",
          );
        }
      },
      onCancel() {
        setBusy(false);
        setMessage("PayPal checkout was canceled. No sandbox payment was captured.");
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
  }, [amountMinor, completed, containerId, organizationId, publicId, sdkReady, validAmount]);

  const tier = entitlements.find(
    (entitlement) =>
      entitlement.key === "tier_3" && entitlement.state === "active",
  );
  const supporter = entitlements.find(
    (entitlement) =>
      entitlement.key === "supporter" && entitlement.state === "active",
  );
  const tierProgress =
    entitlements.find((entitlement) => entitlement.key === "tier_3")
      ?.qualifyingCount ?? 0;

  return (
    <div className="rounded-3xl bg-surface p-5 ring-1 ring-ink/10 sm:p-6">
      <Script
        id={`paypal-sdk-${merchantId}`}
        src={sdkUrl}
        strategy="afterInteractive"
        data-partner-attribution-id={attributionId}
        onLoad={() => setSdkReady(true)}
        onError={() => setMessage("The PayPal Sandbox SDK could not be loaded.")}
      />

      <div className="flex items-center gap-2 rounded-2xl bg-mint/12 px-4 py-3 text-xs font-semibold text-mint-dark ring-1 ring-mint/25">
        <LockKeyhole className="size-4 shrink-0" aria-hidden="true" />
        Secure checkout by PayPal · paid directly to the recipient
      </div>

      <label className="mt-6 block text-sm font-semibold" htmlFor="donation-amount">
        Contribution to {organizationName}
      </label>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {["5.00", "10.00", "25.00", "50.00"].map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={completed}
            onClick={() => {
              setAmount(preset);
              setMessage(null);
            }}
            className={
              amount === preset
                ? "rounded-xl bg-ink px-2 py-2.5 text-sm font-semibold text-white"
                : "rounded-xl bg-paper px-2 py-2.5 text-sm font-semibold text-ink ring-1 ring-line hover:bg-ink/5 disabled:opacity-50"
            }
          >
            ${Number(preset).toFixed(0)}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center rounded-2xl border border-line bg-white px-4 focus-within:ring-2 focus-within:ring-mint">
        <span className="font-semibold text-ink-soft">$</span>
        <input
          id="donation-amount"
          type="number"
          min="1"
          max="1000"
          step="0.01"
          inputMode="decimal"
          value={amount}
          disabled={completed}
          onChange={(event) => setAmount(event.target.value)}
          className="min-h-12 w-full bg-transparent px-2 text-lg font-semibold outline-none"
        />
        <span className="text-sm font-semibold text-ink-soft">USD</span>
      </div>
      {!validAmount && (
        <p className="mt-2 text-xs font-semibold text-coral-dark">
          Enter an amount between $1.00 and $1,000.00.
        </p>
      )}

      <div className="relative mt-5 min-h-12">
        <div id={containerId} className={busy ? "pointer-events-none opacity-60" : ""} />
      </div>

      {message && (
        <p className="mt-4 text-sm font-semibold text-ink" aria-live="polite">
          {message}
        </p>
      )}

      {(supporter || tierProgress > 0) && (
        <div className="mt-5 rounded-2xl bg-ink p-5 text-white">
          <div className="flex items-center gap-2 text-mint">
            {tier ? (
              <Sparkles className="size-5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-5" aria-hidden="true" />
            )}
            <p className="font-semibold">
              {tier ? "Tier 3 supporter unlocked" : "Supporter badge unlocked"}
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/70">
            {tier
              ? "Your verified shopper account has three completed contributions this month."
              : `${Math.min(tierProgress, 3)} of 3 completed contributions toward Tier 3 this month.`}
          </p>
          <p className="mt-3 text-xs font-semibold text-white/60">Your connected benefits have been refreshed.</p>
        </div>
      )}
      {completed && (
        <Link
          href={`/embed/${encodeURIComponent(publicId)}`}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-mint/20 px-5 text-sm font-semibold text-mint-dark ring-1 ring-mint/30 hover:bg-mint/30"
        >
          Return to the campaign
        </Link>
      )}
    </div>
  );
}
