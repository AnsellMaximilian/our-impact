"use client";

import { useActionState } from "react";
import {
  createDeveloperProject,
  createWebhookEndpoint,
  rotateDeveloperSecret,
  type DeveloperActionState,
} from "@/app/dashboard/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

const initial: DeveloperActionState = {};

function RevealedCredentials({ state }: { state: DeveloperActionState }) {
  if (!state.secretKey && !state.webhookSecret) return null;
  return (
    <div className="rounded-2xl bg-ink p-5 text-white" role="status">
      <p className="font-semibold text-mint">{state.success}</p>
      {state.publishableKey && <p className="mt-3 break-all font-mono text-xs">Publishable: {state.publishableKey}</p>}
      {state.secretKey && <p className="mt-2 break-all font-mono text-xs">Server secret: {state.secretKey}</p>}
      {state.webhookSecret && <p className="mt-2 break-all font-mono text-xs">Webhook secret: {state.webhookSecret}</p>}
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
        <span className="mb-2 block text-sm font-semibold">Allowed browser origins</span>
        <textarea name="allowed_origins" rows={3} defaultValue="https://our-impact.vercel.app" className="w-full rounded-2xl border border-line bg-white px-4 py-3 font-mono text-sm" />
        <span className="mt-2 block text-xs leading-5 text-ink-soft">One origin per line. Leave empty for server-only use; add your deployed site before testing the browser SDK.</span>
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
      <SubmitButton pendingLabel="Rotating…" className="bg-white text-ink ring-1 ring-ink/10 hover:bg-paper">Rotate server key</SubmitButton>
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
