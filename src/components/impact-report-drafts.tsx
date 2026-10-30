import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Link2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { z } from "zod";
import {
  generateImpactReport,
  reviewImpactReportDraft,
} from "@/app/dashboard/actions";
import { SubmitButton } from "@/components/submit-button";
import { impactReportContentSchema } from "@/lib/ai/impact-report";
import type { Database } from "@/lib/database.types";

type ImpactReportDraft =
  Database["public"]["Tables"]["impact_report_drafts"]["Row"];

const sourceCatalogSchema = z.array(
  z.object({
    id: z.string(),
    label: z.string(),
    facts: z.record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()]),
    ),
  }),
);

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  }).format(new Date(value));
}

function factLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function ImpactReportDrafts({
  campaignId,
  timezone,
  databaseReady,
  openRouterReady,
  configuredModel,
  isAdmin,
  eligibleSnapshots,
  drafts,
}: {
  campaignId: string;
  timezone: string;
  databaseReady: boolean;
  openRouterReady: boolean;
  configuredModel: string | null;
  isAdmin: boolean;
  eligibleSnapshots: Array<{
    id: string;
    periodSequence: number;
    revision: number;
    createdAt: string;
  }>;
  drafts: ImpactReportDraft[];
}) {
  return (
    <section className="rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">
            <Sparkles className="size-4" aria-hidden="true" /> Stage 4 · AI-assisted reporting
          </div>
          <h2 className="mt-3 text-2xl font-semibold">Grounded impact-report drafts</h2>
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            Generate a draft from the frozen allocation and payment evidence already in
            the ledger. Every content block must cite an allowed source, and a workspace
            owner or admin must approve the result before it is used.
          </p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-mint/15 px-3 py-2 text-xs font-bold text-mint-dark ring-1 ring-mint/35">
          <ShieldCheck className="size-4" aria-hidden="true" /> No publishing or money movement
        </div>
      </div>

      {!databaseReady && (
        <div className="mt-6 flex gap-3 rounded-2xl bg-sun/15 p-4 text-sm leading-6 text-ink-soft ring-1 ring-sun/35">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden="true" />
          <p>
            The Stage 4 database migration is not available yet. Apply the pending
            Supabase migrations, then reload this page.
          </p>
        </div>
      )}

      {databaseReady && !openRouterReady && (
        <div className="mt-6 flex gap-3 rounded-2xl bg-sun/15 p-4 text-sm leading-6 text-ink-soft ring-1 ring-sun/35">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-ink" aria-hidden="true" />
          <p>
            Draft generation is waiting for <code>OPENROUTER_API_KEY</code> and{" "}
            <code>OPENROUTER_MODEL</code> in Vercel. Existing drafts remain readable.
          </p>
        </div>
      )}

      {databaseReady && openRouterReady && configuredModel && (
        <p className="mt-5 text-xs text-ink-soft">
          Configured model: <span className="font-semibold text-ink">{configuredModel}</span>
        </p>
      )}

      {databaseReady && isAdmin && (
        <form action={generateImpactReport} className="mt-6 rounded-2xl bg-paper p-5 ring-1 ring-ink/8">
          <input type="hidden" name="campaign_id" value={campaignId} />
          <label className="grid max-w-xl gap-2 text-sm font-semibold">
            Frozen campaign period
            <select
              name="snapshot_id"
              required
              disabled={!openRouterReady || eligibleSnapshots.length === 0}
              defaultValue={eligibleSnapshots[0]?.id ?? ""}
              className="min-h-12 rounded-xl border border-line bg-white px-4 font-normal disabled:opacity-60"
            >
              {eligibleSnapshots.length === 0 && (
                <option value="">Close and allocate a period first</option>
              )}
              {eligibleSnapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  Period {snapshot.periodSequence}, allocation revision {snapshot.revision} ·{" "}
                  {formatDate(snapshot.createdAt, timezone)}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 max-w-3xl text-xs leading-5 text-ink-soft">
            Only campaign copy, organization names, aggregate votes, allocation amounts,
            and status-only payment evidence are sent. Recipient details, evidence notes,
            and provider identifiers are excluded.
          </p>
          <SubmitButton
            pendingLabel="Checking sources & generating…"
            className="mt-4 min-h-10 px-4 text-sm"
          >
            <Sparkles className="size-4" aria-hidden="true" /> Generate review draft
          </SubmitButton>
        </form>
      )}

      {databaseReady && !isAdmin && (
        <p className="mt-6 rounded-2xl bg-paper p-4 text-sm text-ink-soft ring-1 ring-ink/8">
          You can review existing drafts. Owner or admin access is required to generate
          or approve them.
        </p>
      )}

      <div className="mt-8 space-y-5">
        {drafts.length === 0 && databaseReady && (
          <div className="rounded-2xl border border-dashed border-line p-6 text-sm text-ink-soft">
            No impact-report drafts yet.
          </div>
        )}

        {drafts.map((draft) => {
          const parsedContent = impactReportContentSchema.safeParse(draft.content);
          const parsedSources = sourceCatalogSchema.safeParse(draft.source_catalog);

          if (!parsedContent.success || !parsedSources.success) {
            return (
              <article key={draft.id} className="rounded-2xl bg-coral/10 p-5 ring-1 ring-coral/25">
                <p className="font-semibold">Draft revision {draft.revision} cannot be rendered.</p>
                <p className="mt-2 text-sm text-ink-soft">
                  Its stored content does not match the current report schema. The record
                  was preserved for audit review.
                </p>
              </article>
            );
          }

          const content = parsedContent.data;
          const sources = parsedSources.data;
          const sourceById = new Map(sources.map((source) => [source.id, source]));
          const sourceLabels = (sourceIds: string[]) =>
            sourceIds
              .map((sourceId) => sourceById.get(sourceId)?.label ?? sourceId)
              .join(" · ");

          return (
            <article key={draft.id} className="rounded-2xl bg-white p-5 ring-1 ring-ink/8 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        draft.status === "approved"
                          ? "rounded-full bg-mint/20 px-3 py-1 text-xs font-bold text-mint-dark"
                          : "rounded-full bg-sun/20 px-3 py-1 text-xs font-bold text-ink"
                      }
                    >
                      {draft.status === "approved" ? "Human approved" : "Needs review"}
                    </span>
                    <span className="text-xs text-ink-soft">Revision {draft.revision}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold">{content.title.text}</h3>
                  <p className="mt-1 text-xs text-ink-soft">Title sources: {sourceLabels(content.title.source_ids)}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    Generated {formatDate(draft.created_at, timezone)} with {draft.model}
                  </p>
                </div>
                {isAdmin && (
                  <form action={reviewImpactReportDraft}>
                    <input type="hidden" name="campaign_id" value={campaignId} />
                    <input type="hidden" name="draft_id" value={draft.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={draft.status === "approved" ? "draft" : "approved"}
                    />
                    <SubmitButton
                      pendingLabel="Recording review…"
                      className={
                        draft.status === "approved"
                          ? "min-h-10 bg-white px-4 text-sm text-ink ring-1 ring-ink/15 hover:bg-paper"
                          : "min-h-10 bg-mint-dark px-4 text-sm hover:bg-mint-dark/90"
                      }
                    >
                      {draft.status === "approved" ? (
                        <><RotateCcw className="size-4" aria-hidden="true" /> Return to review</>
                      ) : (
                        <><CheckCircle2 className="size-4" aria-hidden="true" /> Approve draft</>
                      )}
                    </SubmitButton>
                  </form>
                )}
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">Executive summary</p>
                  <p className="mt-2 text-sm leading-6">{content.executive_summary.text}</p>
                  <p className="mt-1 text-xs text-ink-soft">Sources: {sourceLabels(content.executive_summary.source_ids)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">Allocation</p>
                  <p className="mt-2 text-sm leading-6">{content.allocation_summary.text}</p>
                  <p className="mt-1 text-xs text-ink-soft">Sources: {sourceLabels(content.allocation_summary.source_ids)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">Payment evidence</p>
                  <p className="mt-2 text-sm leading-6">{content.payment_summary.text}</p>
                  <p className="mt-1 text-xs text-ink-soft">Sources: {sourceLabels(content.payment_summary.source_ids)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">Required caveats</p>
                  <ul className="mt-2 space-y-2 text-sm leading-6">
                    {content.caveats.map((caveat) => (
                      <li key={`${caveat.text}-${caveat.source_ids.join("-")}`}>
                        • {caveat.text}
                        <span className="block text-xs text-ink-soft">Sources: {sourceLabels(caveat.source_ids)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-paper p-4 ring-1 ring-ink/8">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">
                  <Link2 className="size-4" aria-hidden="true" /> Sourced highlights
                </p>
                <div className="mt-3 space-y-3">
                  {content.highlights.map((highlight) => (
                    <div key={`${highlight.text}-${highlight.source_ids.join("-")}`} className="text-sm leading-6">
                      <p>{highlight.text}</p>
                      <p className="mt-1 text-xs text-ink-soft">
                        Sources: {sourceLabels(highlight.source_ids)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <details className="mt-5 rounded-2xl border border-line p-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  <FileText className="mr-2 inline size-4" aria-hidden="true" /> Review source facts
                </summary>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {sources.map((source) => (
                    <div key={source.id} className="rounded-xl bg-paper p-3 text-xs ring-1 ring-ink/8">
                      <p className="font-bold text-ink">{source.label}</p>
                      <dl className="mt-2 space-y-1 text-ink-soft">
                        {Object.entries(source.facts).map(([key, value]) => (
                          <div key={key} className="grid grid-cols-[8rem_1fr] gap-2">
                            <dt className="capitalize">{factLabel(key)}</dt>
                            <dd className="break-words text-ink">{value === null ? "Not reported" : String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </details>

              <details className="mt-3 rounded-2xl border border-line p-4">
                <summary className="cursor-pointer text-sm font-semibold">Channel-ready copy</summary>
                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <div><p className="text-xs font-bold text-ink-soft">EMAIL</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{content.email_copy.text}</p><p className="mt-1 text-xs text-ink-soft">Sources: {sourceLabels(content.email_copy.source_ids)}</p></div>
                  <div><p className="text-xs font-bold text-ink-soft">SOCIAL</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{content.social_copy.text}</p><p className="mt-1 text-xs text-ink-soft">Sources: {sourceLabels(content.social_copy.source_ids)}</p></div>
                </div>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
