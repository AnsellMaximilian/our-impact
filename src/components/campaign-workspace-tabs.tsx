"use client";

import { useState, type ReactNode } from "react";
import {
  Activity,
  Building2,
  CircleDollarSign,
  UsersRound,
} from "lucide-react";

type TabId = "overview" | "rounds" | "recipients" | "supporters" | "reports";

const tabs: Array<{
  id: TabId;
  label: string;
  icon: typeof Activity;
}> = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "rounds", label: "Rounds & payments", icon: CircleDollarSign },
  { id: "recipients", label: "Recipients", icon: Building2 },
  { id: "supporters", label: "Supporters", icon: UsersRound },
];

export function CampaignWorkspaceTabs({
  overview,
  rounds,
  recipients,
  supporters,
  reports,
  fundingBadge,
}: {
  overview: ReactNode;
  rounds: ReactNode;
  recipients: ReactNode;
  supporters: ReactNode;
  reports: ReactNode;
  fundingBadge?: string | null;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const panels: Record<TabId, ReactNode> = {
    overview,
    rounds,
    recipients,
    supporters,
    reports,
  };

  return (
    <div className="mt-10">
      <div className="overflow-x-auto pb-1">
        <div
          className="flex min-w-max gap-1 rounded-2xl bg-ink/5 p-1.5 ring-1 ring-ink/8"
          role="tablist"
          aria-label="Campaign workspace"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`campaign-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`campaign-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? "bg-white text-ink shadow-sm ring-1 ring-ink/8"
                    : "text-ink-soft hover:bg-white/70 hover:text-ink"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {tab.label}
                {tab.id === "rounds" && fundingBadge && (
                  <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-coral-dark">
                    {fundingBadge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={`campaign-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`campaign-tab-${activeTab}`}
        className="mt-6"
      >
        {panels[activeTab]}
      </div>
    </div>
  );
}
