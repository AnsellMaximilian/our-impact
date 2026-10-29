"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Vote } from "lucide-react";

export type VoteOrganization = {
  id: number;
  name: string;
  shortDescription: string;
  category: string;
  brandColor: string;
  displayOrder: number;
  voteCount: number;
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">
            Community slate
          </p>
          <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">
            Where should the commitment go?
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            One vote per browser identity, per campaign period. These organizations are fictional demo data.
          </p>
        </div>
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-ink/5 px-4 py-2 text-sm font-semibold text-ink-soft">
          {votingOpen ? (
            <>
              <Clock3 className="size-4 text-mint-dark" aria-hidden="true" />
              Open until {closesLabel}
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4" aria-hidden="true" /> Voting closed
            </>
          )}
        </span>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {organizations.map((organization) => {
          const percentage = totalVotes
            ? Math.round((organization.voteCount / totalVotes) * 100)
            : 0;
          const isPending = pendingId === organization.id || isRefreshing;

          return (
            <article
              key={organization.id}
              className="relative overflow-hidden rounded-3xl border border-line bg-white p-5"
            >
              <span
                className="absolute inset-y-0 left-0 w-1.5"
                style={{ backgroundColor: organization.brandColor }}
              />
              <div className="flex items-start justify-between gap-4">
                <span
                  className="grid size-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: organization.brandColor }}
                >
                  {organization.displayOrder}
                </span>
                <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-semibold text-ink-soft">
                  {organization.category}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{organization.name}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-ink-soft">
                {organization.shortDescription}
              </p>

              <div className="mt-5" aria-label={`${organization.voteCount} votes, ${percentage}%`}>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink-soft">
                  <span>{organization.voteCount} {organization.voteCount === 1 ? "vote" : "votes"}</span>
                  <span>{percentage}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink/8">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      backgroundColor: organization.brandColor,
                      width: `${percentage}%`,
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={!votingOpen || isPending}
                onClick={() => castVote(organization.id)}
                className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:bg-ink/8 disabled:text-ink/45"
              >
                <Vote className="size-4" aria-hidden="true" />
                {isPending ? "Submitting…" : votingOpen ? "Vote for this cause" : "Voting closed"}
              </button>
            </article>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-ink">
          {totalVotes} accepted {totalVotes === 1 ? "vote" : "votes"} this period
        </p>
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
