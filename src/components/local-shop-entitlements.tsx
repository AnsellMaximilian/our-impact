"use client";

import { useEffect, useState } from "react";
import { OurImpact, type OurImpactEntitlement } from "@/lib/sdk/our-impact";

export function LocalShopEntitlements({ publishableKey, userToken }: { publishableKey: string; userToken: string }) {
  const [items, setItems] = useState<OurImpactEntitlement[]>([]);
  const [tier3, setTier3] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const impact = new OurImpact({ publishableKey, userToken });
    Promise.all([impact.user.all(), impact.user.is("tier_3")])
      .then(([entitlements, hasTier3]) => { setItems(entitlements); setTier3(hasTier3); })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load roles."));
  }, [publishableKey, userToken]);
  if (error) return <p className="text-sm text-coral-dark">{error}</p>;
  return (
    <div className="space-y-3">
      <div className={`rounded-2xl p-5 ${tier3 ? "bg-mint/20 text-mint-dark" : "bg-ink/5 text-ink-soft"}`}><p className="font-semibold">Tier 3 member perk</p><p className="mt-1 text-sm">{tier3 ? "Unlocked — free pastry this month." : "Locked — complete 3 donations this UTC month."}</p></div>
      {items.map((item) => <div key={item.entitlement_key} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-sm"><code>{item.entitlement_key}</code><span className="font-semibold">{item.state} · {item.qualifying_count}</span></div>)}
      {!items.length && <p className="text-sm text-ink-soft">No donation events yet.</p>}
    </div>
  );
}
