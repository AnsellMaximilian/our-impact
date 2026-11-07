"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Check,
  CircleDashed,
  ExternalLink,
  Globe2,
  HeartHandshake,
  Mail,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { RecipientInvitationForm } from "@/components/recipient-invitation-form";

export type RecipientNetworkItem = {
  id: number;
  name: string;
  category: string;
  shortDescription: string;
  websiteUrl: string | null;
  imageSrc: string;
  relationship: string;
  representativeVerified: boolean;
  invitation: { contactEmail: string; status: string } | null;
  connection: {
    status: string;
    curationState: string;
    paymentsReceivable: boolean;
    permissionsGranted: boolean;
    primaryEmailConfirmed: boolean;
  } | null;
  campaigns: Array<{ id: string; title: string; status: string }>;
};

function readiness(item: RecipientNetworkItem) {
  const paypalReady = item.connection?.status === "active"
    && item.connection.curationState === "approved"
    && item.connection.paymentsReceivable
    && item.connection.permissionsGranted
    && item.connection.primaryEmailConfirmed;
  return { representativeVerified: item.representativeVerified, paypalReady };
}

function StatusPill({ ready }: { ready: boolean }) {
  return (
    <span className={ready ? "inline-flex items-center gap-1.5 rounded-full bg-mint/18 px-2.5 py-1 text-[11px] font-bold text-mint-dark" : "inline-flex items-center gap-1.5 rounded-full bg-sun/25 px-2.5 py-1 text-[11px] font-bold text-ink"}>
      {ready ? <BadgeCheck className="size-3.5" /> : <CircleDashed className="size-3.5" />}
      {ready ? "Ready" : "Setup in progress"}
    </span>
  );
}

function SetupLine({ complete, label }: { complete: boolean; label: string }) {
  return (
    <li className="flex items-center gap-3 border-b border-ink/8 py-2.5 last:border-b-0">
      <span className={complete ? "grid size-6 place-items-center rounded-full bg-mint text-ink" : "grid size-6 place-items-center rounded-full bg-ink/7 text-ink-soft"}>
        {complete ? <Check className="size-3.5" /> : <CircleDashed className="size-3.5" />}
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </li>
  );
}

function RecipientDetails({
  item,
  canInvite,
  onClose,
  mobile = false,
}: {
  item: RecipientNetworkItem;
  canInvite: boolean;
  onClose?: () => void;
  mobile?: boolean;
}) {
  const { representativeVerified, paypalReady } = readiness(item);

  return (
    <div className={mobile ? "min-h-full bg-paper" : "dashboard-card overflow-hidden rounded-[1.5rem]"}>
      {mobile && (
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/10 bg-paper/95 px-4 py-3 backdrop-blur">
          <button type="button" onClick={onClose} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold"><ArrowLeft className="size-4" /> Recipients</button>
          <button type="button" onClick={onClose} aria-label="Close recipient details" className="grid size-10 place-items-center rounded-full border border-ink/12 bg-white"><X className="size-4" /></button>
        </div>
      )}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-mint-dark">Recipient profile</p><h2 className="display-type mt-2 text-2xl font-semibold sm:text-3xl">{item.name}</h2></div>
          <StatusPill ready={paypalReady} />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-[132px_minmax(0,1fr)]">
          <div className="relative h-32 overflow-hidden rounded-2xl bg-[#e3eee3]"><Image src={item.imageSrc} alt="" fill sizes="132px" className="object-contain p-2" /></div>
          <div><span className="inline-flex rounded-full bg-mint/14 px-2.5 py-1 text-xs font-bold text-mint-dark">{item.category}</span><p className="mt-3 text-sm leading-6 text-ink-soft">{item.shortDescription}</p>{item.websiteUrl && <a href={item.websiteUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink"><Globe2 className="size-3.5" /> Visit website <ExternalLink className="size-3" /></a>}</div>
        </div>
      </div>

      <div className="border-t border-ink/10 px-5 py-5 sm:px-6">
        <h3 className="text-lg font-semibold">Setup</h3>
        <ul className="mt-2"><SetupLine complete label="Organization details" /><SetupLine complete={representativeVerified} label="Representative verified" /><SetupLine complete={paypalReady} label="PayPal payouts connected" /></ul>
      </div>

      <div className="border-t border-ink/10 px-5 py-5 sm:px-6">
        <h3 className="text-lg font-semibold">Representative</h3>
        <div className="mt-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-mint/18 text-mint-dark"><Mail className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.invitation?.contactEmail ?? "No representative invited"}</p><p className="mt-0.5 text-xs text-ink-soft">{representativeVerified ? "Identity verified" : item.invitation ? "Invitation pending" : "Invitation required"}</p></div></div>
      </div>

      <div className="border-t border-ink/10 px-5 py-5 sm:px-6">
        <h3 className="text-lg font-semibold">Direct donations</h3>
        <div className="mt-3 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#eef5ff] text-[#1264a3]"><WalletCards className="size-5" /></span><div><p className="text-sm font-semibold">{paypalReady ? "PayPal connected" : "PayPal setup incomplete"}</p><p className="mt-0.5 text-xs text-ink-soft">{paypalReady ? "Ready to receive campaign funding" : "Complete recipient verification to enable payments"}</p></div></div>
      </div>

      <div className="border-t border-ink/10 px-5 py-5 sm:px-6">
        <h3 className="text-lg font-semibold">Campaign usage</h3>
        {item.campaigns.length ? <div className="mt-3 space-y-2">{item.campaigns.map((campaign) => <Link key={campaign.id} href={`/dashboard/campaigns/${campaign.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-paper px-3 py-2.5 text-sm transition hover:bg-mint/10"><span className="min-w-0 truncate font-semibold">{campaign.title}</span><span className={campaign.status === "published" ? "rounded-full bg-mint/18 px-2 py-1 text-[10px] font-bold capitalize text-mint-dark" : "rounded-full bg-sun/25 px-2 py-1 text-[10px] font-bold capitalize text-ink"}>{campaign.status}</span></Link>)}</div> : <p className="mt-3 text-sm text-ink-soft">Not used in a campaign yet.</p>}
      </div>

      {canInvite && <div className="border-t border-ink/10 px-5 pb-6 sm:px-6"><RecipientInvitationForm organizationId={item.id} initialEmail={item.invitation?.contactEmail} /></div>}
    </div>
  );
}

export function RecipientNetwork({ items, canInvite }: { items: RecipientNetworkItem[]; canInvite: boolean }) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? items[0] ?? null, [items, selectedId]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [mobileOpen]);

  if (!selected) return <div className="dashboard-card rounded-[1.5rem] px-8 py-16 text-center"><Building2 className="mx-auto size-8 text-coral-dark" /><p className="mt-4 font-semibold">No recipient partners yet</p><p className="mt-2 text-sm text-ink-soft">Add the first organization your community will be able to support.</p></div>;

  function select(item: RecipientNetworkItem) {
    setSelectedId(item.id);
    if (window.matchMedia("(max-width: 1023px)").matches) setMobileOpen(true);
  }

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] lg:items-start">
        <div className="space-y-3">
          {items.map((item) => {
            const { paypalReady } = readiness(item);
            const active = item.id === selected.id;
            return (
              <button key={item.id} type="button" onClick={() => select(item)} className={`dashboard-card grid w-full gap-3 rounded-[1.25rem] p-3 text-left transition sm:grid-cols-[104px_minmax(0,1fr)_auto] sm:items-center ${active ? "ring-2 ring-mint-dark/55" : "hover:-translate-y-0.5 hover:border-ink/25"}`}>
                <div className="relative h-24 overflow-hidden rounded-xl bg-[#e3eee3]"><Image src={item.imageSrc} alt="" fill sizes="104px" className="object-contain p-1.5" /></div>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold sm:text-lg">{item.name}</h3><span className="rounded-full bg-ink/6 px-2 py-0.5 text-[10px] font-bold text-ink-soft">{item.category}</span></div><p className="mt-1 line-clamp-2 text-sm leading-5 text-ink-soft">{item.shortDescription}</p><div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-ink-soft"><span className="inline-flex items-center gap-1"><HeartHandshake className="size-3.5" /> {item.campaigns.length} campaign{item.campaigns.length === 1 ? "" : "s"}</span><span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" /> {item.relationship}</span></div></div>
                <div className="sm:self-start"><StatusPill ready={paypalReady} /></div>
              </button>
            );
          })}
        </div>
        <aside className="sticky top-5 hidden lg:block"><RecipientDetails item={selected} canInvite={canInvite} /></aside>
      </div>

      {mobileOpen && <div className="fixed inset-0 z-50 overflow-y-auto lg:hidden" role="dialog" aria-modal="true" aria-label={`${selected.name} details`}><RecipientDetails item={selected} canInvite={canInvite} mobile onClose={() => setMobileOpen(false)} /></div>}
    </>
  );
}
