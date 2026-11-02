"use client";

import { useEffect, useState } from "react";
import { OurImpact, type OurImpactEntitlement } from "@/lib/sdk/our-impact";

const THEMES = {
  garden: { name: "Garden", panel: "bg-[#264c37] text-white", accent: "bg-[#dff28b] text-[#264c37]" },
  sunrise: { name: "Sunrise", panel: "bg-[#bd5c3d] text-white", accent: "bg-[#ffd27d] text-[#5c2c1c]" },
  night: { name: "Night", panel: "bg-[#17263d] text-white", accent: "bg-[#9cc7ff] text-[#17263d]" },
} as const;
type ThemeId = keyof typeof THEMES;

export function LocalShopEntitlements({ publishableKey, userToken }: { publishableKey: string; userToken: string }) {
  const [items, setItems] = useState<OurImpactEntitlement[]>([]);
  const [unlocked, setUnlocked] = useState(false);
  const [themeId, setThemeId] = useState<ThemeId>("garden");
  const [error, setError] = useState<string>();
  useEffect(() => {
    const impact = new OurImpact({ publishableKey, userToken });
    Promise.all([impact.user.all(), impact.user.is("community_champion_theme")])
      .then(([entitlements, hasTheme]) => {
        setItems(entitlements);
        setUnlocked(hasTheme);
        const stored = window.localStorage.getItem("mikes-vegan-shop-theme") as ThemeId | null;
        if (hasTheme && stored && stored in THEMES) setThemeId(stored);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load benefits."));
  }, [publishableKey, userToken]);

  const theme = THEMES[themeId];
  function chooseTheme(next: ThemeId) {
    if (!unlocked) return;
    setThemeId(next);
    window.localStorage.setItem("mikes-vegan-shop-theme", next);
  }

  if (error) return <p className="text-sm text-coral-dark">{error}</p>;
  return (
    <div className="space-y-4">
      <div className={`rounded-3xl p-5 transition-colors ${theme.panel}`}>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${theme.accent}`}>Community Champion</span>
        <p className="mt-4 text-xl font-semibold">{unlocked ? `${theme.name} shop theme active` : "Shop themes are locked"}</p>
        <p className="mt-1 text-sm opacity-75">{unlocked ? "Your verified contribution unlocked this experience." : "Support a community recipient once to unlock them."}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(Object.entries(THEMES) as [ThemeId, (typeof THEMES)[ThemeId]][]).map(([id, option]) => (
          <button
            key={id}
            type="button"
            disabled={!unlocked}
            onClick={() => chooseTheme(id)}
            className={id === themeId
              ? "rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-white"
              : "rounded-xl bg-white px-3 py-2 text-xs font-semibold text-ink ring-1 ring-line disabled:cursor-not-allowed disabled:opacity-40"}
          >{option.name}</button>
        ))}
      </div>
      {items.map((item) => (
        <div key={item.entitlement_key} className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-xs">
          <code>{item.entitlement_key}</code><span className="font-semibold">{item.state} · {item.qualifying_count}</span>
        </div>
      ))}
      {!items.length && <p className="text-sm text-ink-soft">No verified donation events yet.</p>}
    </div>
  );
}
