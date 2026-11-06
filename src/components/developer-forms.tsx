"use client";

import { useActionState } from "react";
import {
  createDeveloperProject,
  createWebhookEndpoint,
  rotateDeveloperSecret,
  updateDeveloperAllowedOrigins,
  type DeveloperActionState,
} from "@/app/dashboard/actions";
import { CopyValueButton } from "@/components/copy-value-button";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

const initial: DeveloperActionState = {};

function RevealedCredentials({ state }: { state: DeveloperActionState }) {
  if (!state.secretKey && !state.webhookSecret) return null;
  return (
    <div className="rounded-2xl bg-ink p-5 text-white" role="status">
      <p className="font-semibold text-mint">{state.success}</p>
      {state.secretKey && <p className="mt-2 text-xs leading-5 text-white/65">This full server secret is shown once. Copy it into <code className="text-white">OUR_IMPACT_SECRET_KEY</code> before leaving this page.</p>}
      <div className="mt-4 space-y-3">
        {state.publishableKey && <RevealedValue label="Browser publishable key · OUR_IMPACT_PUBLISHABLE_KEY" value={state.publishableKey} />}
        {state.secretKey && <RevealedValue label="Server secret · OUR_IMPACT_SECRET_KEY" value={state.secretKey} />}
        {state.webhookSecret && <RevealedValue label="Webhook signing secret" value={state.webhookSecret} />}
      </div>
    </div>
  );
}

function RevealedValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/8 p-3 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/55">{label}</p>
        <CopyValueButton value={value} label="Copy" className="text-mint hover:bg-white/10" />
      </div>
      <code className="mt-2 block break-all text-xs text-white">{value}</code>
    </div>
  );
}

export function DeveloperProjectForm() {
  const [state, action] = useActionState(createDeveloperProject, initial);
  return (
    <form action={action} className="space-y-5 rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:p-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">Developer project</p>
        <h2 className="mt-2 text-2xl font-semibold">Connect Mike’s shop website</h2>
      </div>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Project name</span>
        <input name="name" required minLength={2} maxLength={80} defaultValue="Mike’s Vegan Shop Website" className="min-h-12 w-full rounded-2xl border border-line bg-white px-4" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Browser app origins</span>
        <textarea name="allowed_origins" rows={3} defaultValue={"http://localhost:4173\nhttps://our-impact.vercel.app"} className="w-full rounded-2xl border border-line bg-white px-4 py-3 font-mono text-sm" />
        <span className="mt-2 block text-xs leading-5 text-ink-soft">Where your browser integration runs—not an API URL. The defaults support the local Mike example and Our Impact’s hosted demo. Add your own deployed website before launch.</span>
      </label>
      <FormMessage error={state.error} />
      <RevealedCredentials state={state} />
      <SubmitButton pendingLabel="Creating project…">Create project and key</SubmitButton>
    </form>
  );
}

export function RotateKeyForm({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(rotateDeveloperSecret, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      <RevealedCredentials state={state} />
      <FormMessage error={state.error} />
      <p className="text-xs leading-5 text-ink-soft">Need the full value? Generate a replacement. The current active secret will be revoked immediately.</p>
      <SubmitButton pendingLabel="Replacing…" className="bg-white text-ink ring-1 ring-ink/10 hover:bg-paper">Replace and reveal server secret</SubmitButton>
    </form>
  );
}

export function AllowedOriginsForm({
  projectId,
  origins,
}: {
  projectId: string;
  origins: string[];
}) {
  const [state, action] = useActionState(updateDeveloperAllowedOrigins, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="project_id" value={projectId} />
      <label className="block">
        <span className="text-sm font-semibold">Allowed browser origins</span>
        <span className="mt-1 block text-xs leading-5 text-ink-soft">One exact origin per line. Add <code>http://localhost:4173</code> for the local Mike’s Vegan Shop example.</span>
        <textarea
          name="allowed_origins"
          rows={3}
          defaultValue={origins.join("\n")}
          placeholder={"http://localhost:4173\nhttps://shop.example.com"}
          className="mt-3 w-full rounded-xl border border-line bg-white px-3 py-2.5 font-mono text-xs leading-5"
        />
      </label>
      <FormMessage error={state.error} message={state.success} />
      <SubmitButton pendingLabel="Saving…" className="bg-white text-ink ring-1 ring-ink/10 hover:bg-paper">Save browser origins</SubmitButton>
    </form>
  );
}

export function WebhookForm({ projectId }: { projectId: string }) {
  const [state, action] = useActionState(createWebhookEndpoint, initial);
  return (
    <form action={action} className="space-y-4 rounded-2xl border border-line bg-white p-5">
      <input type="hidden" name="project_id" value={projectId} />
      <div>
        <p className="font-semibold">Add webhook endpoint</p>
        <p className="mt-1 text-sm text-ink-soft">Receives donation and entitlement events with an HMAC signature.</p>
      </div>
      <input type="url" name="url" required placeholder="https://webhook.site/…" className="min-h-11 w-full rounded-xl border border-line px-3" />
      <input name="description" maxLength={200} placeholder="Sandbox listener" className="min-h-11 w-full rounded-xl border border-line px-3" />
      <FormMessage error={state.error} />
      <RevealedCredentials state={state} />
      <SubmitButton pendingLabel="Saving…">Add webhook</SubmitButton>
    </form>
  );
}
