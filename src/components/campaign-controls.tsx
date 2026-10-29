"use client";

import { useFormStatus } from "react-dom";
import { Pause, Play, Rocket, Trash2 } from "lucide-react";
import {
  deleteDraftCampaign,
  publishDraftCampaign,
  setCampaignStatus,
} from "@/app/dashboard/actions";
import { cn } from "@/lib/utils";

function ActionButton({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60",
        className,
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function CampaignControls({
  campaignId,
  status,
}: {
  campaignId: string;
  status: string;
}) {
  if (status === "draft") {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <form
          action={deleteDraftCampaign}
          onSubmit={(event) => {
            if (!window.confirm("Delete this private draft? This cannot be undone.")) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="campaign_id" value={campaignId} />
          <ActionButton
            pendingLabel="Deleting…"
            className="w-full border border-coral/30 bg-white text-coral-dark hover:bg-coral/8 sm:w-auto"
          >
            <Trash2 className="size-4" aria-hidden="true" /> Delete draft
          </ActionButton>
        </form>
        <form action={publishDraftCampaign}>
          <input type="hidden" name="campaign_id" value={campaignId} />
          <ActionButton
            pendingLabel="Publishing…"
            className="w-full bg-ink text-white shadow-[0_10px_24px_rgba(16,38,63,0.18)] hover:-translate-y-0.5 hover:bg-ink/90 sm:w-auto"
          >
            <Rocket className="size-4" aria-hidden="true" /> Publish campaign
          </ActionButton>
        </form>
      </div>
    );
  }

  if (status === "published" || status === "paused") {
    const nextStatus = status === "published" ? "paused" : "published";
    return (
      <form action={setCampaignStatus}>
        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="status" value={nextStatus} />
        <ActionButton
          pendingLabel={status === "published" ? "Pausing…" : "Resuming…"}
          className="border border-ink/15 bg-white text-ink hover:border-ink/30"
        >
          {status === "published" ? (
            <><Pause className="size-4" aria-hidden="true" /> Pause public voting</>
          ) : (
            <><Play className="size-4" aria-hidden="true" /> Resume public voting</>
          )}
        </ActionButton>
      </form>
    );
  }

  return null;
}
