"use client";

import { useActionState } from "react";
import { createCompany, type DashboardActionState } from "@/app/dashboard/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

const initialState: DashboardActionState = {};

export function OnboardingForm() {
  const [state, action] = useActionState(createCompany, initialState);

  return (
    <form action={action} className="mt-8 space-y-5">
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Internal company name</span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          placeholder="Sunrise Coffee Company"
          className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base"
        />
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Name visitors should see</span>
        <input
          name="public_name"
          required
          minLength={2}
          maxLength={120}
          placeholder="Sunrise Coffee"
          className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 text-base"
        />
      </label>

      <FormMessage error={state.error} />
      <SubmitButton pendingLabel="Creating workspace…">Create workspace</SubmitButton>
    </form>
  );
}
