"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthActionState } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

const initialState: AuthActionState = {};

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [signInState, signInAction] = useActionState(signIn, initialState);
  const [signUpState, signUpAction] = useActionState(signUp, initialState);
  const state = mode === "signin" ? signInState : signUpState;

  return (
    <div className="rounded-[2rem] bg-surface p-6 shadow-[0_24px_70px_rgba(16,38,63,0.12)] ring-1 ring-ink/8 sm:p-8">
      <div className="mb-7 grid grid-cols-2 rounded-full bg-ink/5 p-1" aria-label="Authentication mode">
        {(["signin", "signup"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={cn(
              "rounded-full px-4 py-2.5 text-sm font-semibold transition",
              mode === item
                ? "bg-white text-ink shadow-sm"
                : "text-ink-soft hover:text-ink",
            )}
          >
            {item === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <div className="mb-7">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-coral-dark">
          {mode === "signin" ? "Welcome back" : "Get started"}
        </p>
        <h2 className="display-type mt-2 text-3xl font-semibold">
          {mode === "signin" ? "Sign in to your workspace." : "Create your Our Impact workspace."}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          {mode === "signin"
            ? "Manage your campaigns, recipients, and customer benefits."
            : "Start with a campaign now and connect your product whenever you’re ready."}
        </p>
      </div>

      <form action={mode === "signin" ? signInAction : signUpAction} className="space-y-5">
        {mode === "signup" && (
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Your name</span>
            <input
              name="display_name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={80}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base placeholder:text-ink-soft/55"
              placeholder="Michael Scott"
            />
          </label>
        )}

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Email address</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base placeholder:text-ink-soft/55"
            placeholder="michael@company.com"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Password</span>
          <input
            key={mode}
            name="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={mode === "signup" ? 8 : 1}
            className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base"
          />
          {mode === "signup" && (
            <span className="mt-2 block text-xs leading-5 text-ink-soft">
              Use at least 8 characters with a letter, number, and symbol.
            </span>
          )}
        </label>

        <FormMessage error={state.error} message={state.message} />

        <SubmitButton
          pendingLabel={mode === "signin" ? "Signing in…" : "Creating account…"}
          className="w-full"
        >
          {mode === "signin" ? "Continue to dashboard" : "Create my account"}
        </SubmitButton>
      </form>
    </div>
  );
}
