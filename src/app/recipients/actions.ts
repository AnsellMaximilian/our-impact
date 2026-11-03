"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  recipientInvitationPath,
  verifyRecipientInvitationToken,
} from "@/lib/recipient-invitations";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { createClient } from "@/lib/supabase/server";

export type RecipientAccessState = {
  error?: string;
  message?: string;
  claimed?: boolean;
};

const tokenSchema = z.string().min(40).max(200);

function parsedToken(formData: FormData) {
  const parsed = tokenSchema.safeParse(formData.get("invite_token"));
  if (!parsed.success) return null;
  const invitationId = verifyRecipientInvitationToken(parsed.data);
  return invitationId ? { invitationId, token: parsed.data } : null;
}

function invitationExpired(status: string, expiresAt: string) {
  return status === "pending" && new Date(expiresAt).getTime() <= Date.now();
}

export async function requestRecipientAccess(
  _state: RecipientAccessState,
  formData: FormData,
): Promise<RecipientAccessState> {
  const parsed = parsedToken(formData);
  if (!parsed) return { error: "This recipient invitation is invalid." };

  const privileged = createPrivilegedClient();
  const { data: invitation } = await privileged
    .from("recipient_invitations")
    .select("contact_email, status, expires_at")
    .eq("id", parsed.invitationId)
    .maybeSingle();

  if (
    !invitation ||
    invitation.status === "revoked" ||
    invitationExpired(invitation.status, invitation.expires_at)
  ) {
    return { error: "This invitation is unavailable or has expired." };
  }

  const siteOrigin = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const nextPath = recipientInvitationPath(parsed.invitationId);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: invitation.contact_email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${siteOrigin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
    },
  });

  if (error) {
    console.error("recipient_magic_link_failed", {
      code: error.code,
      invitationId: parsed.invitationId,
    });
    return { error: "We could not send the secure access link. Try again shortly." };
  }

  return {
    message: "Secure access link sent. Open it from the invited email account to continue.",
  };
}

export async function claimRecipientInvitation(
  _state: RecipientAccessState,
  formData: FormData,
): Promise<RecipientAccessState> {
  const parsed = parsedToken(formData);
  if (!parsed) return { error: "This recipient invitation is invalid." };

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  const userEmail = user?.email?.trim().toLowerCase();
  if (authError || !user || !userEmail) {
    return { error: "Open the secure email link before claiming this recipient." };
  }

  const privileged = createPrivilegedClient();
  const { data: invitation } = await privileged
    .from("recipient_invitations")
    .select("id, company_id, organization_id, contact_email, status, expires_at")
    .eq("id", parsed.invitationId)
    .maybeSingle();
  if (
    !invitation ||
    invitation.status === "revoked" ||
    invitationExpired(invitation.status, invitation.expires_at)
  ) {
    return { error: "This invitation is unavailable or has expired." };
  }
  if (invitation.contact_email.trim().toLowerCase() !== userEmail) {
    return { error: "Sign in with the email address that received this invitation." };
  }

  const { data: existing } = await privileged
    .from("recipient_memberships")
    .select("user_id")
    .eq("invitation_id", invitation.id)
    .maybeSingle();
  if (existing && existing.user_id !== user.id) {
    return { error: "This invitation has already been claimed by another account." };
  }
  if (!existing) {
    const { error } = await privileged.from("recipient_memberships").insert({
      organization_id: invitation.organization_id,
      user_id: user.id,
      company_id: invitation.company_id,
      invitation_id: invitation.id,
      claimed_email: userEmail,
      role: "admin",
    });
    if (error) {
      console.error("recipient_claim_failed", {
        code: error.code,
        invitationId: invitation.id,
      });
      return { error: "We could not claim this recipient. Refresh and try again." };
    }
  }

  revalidatePath(recipientInvitationPath(invitation.id));
  revalidatePath("/recipients/portal");
  return { claimed: true, message: "Recipient access verified. You can now connect PayPal." };
}

export async function switchRecipientAccount(formData: FormData) {
  const parsed = parsedToken(formData);
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(parsed ? recipientInvitationPath(parsed.invitationId) : "/");
}
