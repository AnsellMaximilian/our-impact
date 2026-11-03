"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, MailCheck, ShieldCheck } from "lucide-react";
import {
  claimRecipientInvitation,
  requestRecipientAccess,
  type RecipientAccessState,
} from "@/app/recipients/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

const initialState: RecipientAccessState = {};

export function RecipientMagicLinkForm({ invitationToken }: { invitationToken: string }) {
  const [state, action] = useActionState(requestRecipientAccess, initialState);
  return (
    <form action={action} className="rounded-3xl bg-white p-6 ring-1 ring-ink/8">
      <input type="hidden" name="invite_token" value={invitationToken} />
      <MailCheck className="size-6 text-coral-dark" aria-hidden="true" />
      <h2 className="mt-4 text-xl font-semibold">Verify the invited email</h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        We will send a one-time secure link to the representative address supplied by the program owner. No password is required.
      </p>
      <div className="mt-4"><FormMessage error={state.error} message={state.message} /></div>
      <SubmitButton pendingLabel="Sending secure link…" className="mt-4 w-full">
        Email my secure access link
      </SubmitButton>
    </form>
  );
}

export function RecipientClaimForm({ invitationToken }: { invitationToken: string }) {
  const [state, action] = useActionState(claimRecipientInvitation, initialState);
  const router = useRouter();
  useEffect(() => {
    if (state.claimed) router.refresh();
  }, [router, state.claimed]);
  return (
    <form action={action} className="rounded-3xl bg-mint/12 p-6 ring-1 ring-mint/30">
      <input type="hidden" name="invite_token" value={invitationToken} />
      {state.claimed ? <BadgeCheck className="size-6 text-mint-dark" /> : <ShieldCheck className="size-6 text-mint-dark" />}
      <h2 className="mt-4 text-xl font-semibold">
        {state.claimed ? "Recipient access verified" : "Claim the recipient portal"}
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        {state.claimed
          ? "Opening your recipient-owned PayPal connection controls…"
          : "Your verified email matches this invitation. Confirm that you represent this organization before connecting its PayPal account."}
      </p>
      <div className="mt-4"><FormMessage error={state.error} message={state.message} /></div>
      {!state.claimed && (
        <SubmitButton pendingLabel="Verifying access…" className="mt-4 w-full">
          I represent this recipient
        </SubmitButton>
      )}
    </form>
  );
}
