"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock3 } from "lucide-react";

export type VoteOrganization = {
  id: number;
  name: string;
  shortDescription: string;
  category: string;
  brandColor: string;
  displayOrder: number;
  voteCount: number;
  donationEnabled: boolean;
};

export function VoteWidget({
  publicId,
  organizations,
  totalVotes,
  votingOpen,
  closesAt,
  timezone,
}: {
  publicId: string;
  organizations: VoteOrganization[];
  totalVotes: number;
  votingOpen: boolean;
  closesAt: string | null;
  timezone: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [isRefreshing, startTransition] = useTransition();
  const closesLabel = closesAt
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
        timeZoneName: "short",
      }).format(new Date(closesAt))
    : null;

  async function castVote(organizationId: number) {
    setPendingId(organizationId);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/campaigns/${encodeURIComponent(publicId)}/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId }),
        },
      );
      const result = (await response.json()) as { message?: string; status?: string };

      setNotice({
        kind: response.ok ? "success" : "error",
        message: result.message ?? "We couldn’t submit this vote.",
      });

      if (response.ok) {
        startTransition(() => router.refresh());
      }
    } catch {
      setNotice({
        kind: "error",
        message: "We couldn’t reach the voting service. Please try again.",
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold sm:text-2xl">Choose a community recipient</h2>
          <p className="mt-1 text-sm leading-6 text-ink-soft">Vote once this round, or donate directly to a connected organization.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-soft">
          <span className="rounded-full bg-ink/5 px-3 py-2">{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</span>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ink/5 px-3 py-2">
            {votingOpen ? <><Clock3 className="size-3.5 text-mint-dark" aria-hidden="true" /> Open until {closesLabel}</> : <><CheckCircle2 className="size-3.5" aria-hidden="true" /> Voting closed</>}
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {organizations.map((organization) => {
          const percentage = totalVotes
            ? Math.round((organization.voteCount / totalVotes) * 100)
            : 0;
          const isPending = pendingId === organization.id || isRefreshing;

          return (
            <article
              key={organization.id}
              className="relative overflow-hidden rounded-2xl border border-line bg-white p-5 pl-6"
            >
              <span
                className="absolute inset-y-0 left-0 w-1.5"
                style={{ backgroundColor: organization.brandColor }}
              />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">{organization.name}</h3>
                  <p className="mt-1 text-sm leading-6 text-ink-soft">{organization.shortDescription}</p>
                </div>
                <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold text-ink-soft">
                  {organization.category}
                </span>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(14rem,1fr)_auto] lg:items-end">
                <div aria-label={`${organization.voteCount} votes, ${percentage}%`}>
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-soft">
                    <span>{organization.voteCount} {organization.voteCount === 1 ? "vote" : "votes"}</span>
                    <span>{percentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink/8">
                    <div className="h-full rounded-full transition-[width] duration-500" style={{ backgroundColor: organization.brandColor, width: `${percentage}%` }} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!votingOpen || isPending}
                    onClick={() => castVote(organization.id)}
                    className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-ink px-6 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-ink/8 disabled:text-ink/45 lg:flex-none"
                  >
                    {isPending ? "Saving…" : votingOpen ? "Vote" : "Closed"}
                  </button>
                  {organization.donationEnabled && (
                    <Link href={`/embed/${encodeURIComponent(publicId)}/donate/${organization.id}`} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-mint/15 px-6 text-sm font-semibold text-mint-dark ring-1 ring-mint/30 transition hover:bg-mint/25 lg:flex-none">
                      Donate
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-4 flex min-h-5 items-center justify-end">
        <p
          aria-live="polite"
          className={notice?.kind === "success" ? "text-sm font-semibold text-mint-dark" : "text-sm font-semibold text-coral-dark"}
        >
          {notice?.message}
        </p>
      </div>
    </>
  );
}
