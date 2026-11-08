"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error?: string;
  message?: string;
  values?: {
    email: string;
    displayName?: string;
  };
};

const emailSchema = z.string().trim().email("Enter a valid email address.");

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(80, "Keep your name under 80 characters."),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[A-Za-z]/, "Password must include a letter.")
    .regex(/[0-9]/, "Password must include a number.")
    .regex(/[^A-Za-z0-9]/, "Password must include a symbol."),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function signInError(code?: string) {
  switch (code) {
    case "email_not_confirmed":
      return "Confirm your email before signing in. Open the newest confirmation message in your inbox.";
    case "over_request_rate_limit":
      return "Too many sign-in attempts. Wait a few minutes, then try again.";
    default:
      return "We couldn’t sign you in. Check your email and password.";
  }
}

function signUpError(code?: string) {
  switch (code) {
    case "weak_password":
      return "Choose a stronger password with at least 8 characters, including a letter, number, and symbol.";
    case "email_exists":
    case "user_already_exists":
      return "An account with this email already exists. Sign in instead.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many signup attempts. Wait a few minutes, then try again.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "Account creation is temporarily unavailable. Please try again later.";
    default:
      return "We couldn’t create your account. Review your details and try again.";
  }
}

export async function signIn(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const values = {
    email: formValue(formData, "email").trim(),
  };
  const parsed = signInSchema.safeParse({
    email: values.email,
    password: formValue(formData, "password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check your details.",
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: signInError(error.code), values };
  }

  redirect("/dashboard");
}

export async function signUp(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const values = {
    displayName: formValue(formData, "display_name").trim(),
    email: formValue(formData, "email").trim(),
  };
  const parsed = signUpSchema.safeParse({
    displayName: values.displayName,
    email: values.email,
    password: formValue(formData, "password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check your details.",
      values,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    return { error: signUpError(error.code), values };
  }

  if (data.session) {
    redirect("/dashboard");
  }

  return {
    message: "Check your inbox to confirm your email, then return here to sign in.",
    values,
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
