"use client";

import { Check, Copy, Mail } from "lucide-react";
import { useActionState, useState } from "react";
import {
  createRecipientInvitation,
  type DashboardActionState,
} from "@/app/dashboard/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function RecipientInvitationForm({
  organizationId,
  initialEmail,
}: {
  organizationId: number;
  initialEmail?: string | null;
}) {
  const [state, action] = useActionState(
    createRecipientInvitation,
    {} as DashboardActionState,
  );
  const [copied, setCopied] = useState(false);

  async function copyInvitation() {
    if (!state.inviteUrl) return;
    await navigator.clipboard.writeText(state.inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <form action={action} className="mt-4 space-y-3 border-t border-line pt-4">
      <input type="hidden" name="organization_id" value={organizationId} />
      <label className="block">
        <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
          <Mail className="size-3.5" aria-hidden="true" /> Recipient representative
        </span>
        <input
          type="email"
          name="contact_email"
          required
          maxLength={320}
          defaultValue={initialEmail ?? ""}
          placeholder="director@example.org"
          className="min-h-10 w-full rounded-xl border border-line bg-white px-3 text-sm"
        />
      </label>
      <FormMessage error={state.error} message={state.success} />
      {state.inviteUrl && (
        <div className="rounded-xl bg-mint/10 p-3 ring-1 ring-mint/25">
          <p className="break-all font-mono text-xs leading-5 text-ink-soft">
            {state.inviteUrl}
          </p>
          <button
            type="button"
            onClick={copyInvitation}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-mint-dark"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy private invitation"}
          </button>
        </div>
      )}
      <SubmitButton pendingLabel="Preparing invitation…" className="min-h-10 px-4 py-2 text-sm">
        {initialEmail ? "Refresh invitation link" : "Create invitation link"}
      </SubmitButton>
    </form>
  );
}
