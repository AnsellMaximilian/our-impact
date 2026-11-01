"use client";

import { useActionState } from "react";
import { createWorkspaceRecipient, type DashboardActionState } from "@/app/dashboard/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function RecipientForm() {
  const [state, action] = useActionState(createWorkspaceRecipient, {} as DashboardActionState);
  return (
    <form action={action} className="grid gap-5 rounded-[2rem] bg-surface p-6 ring-1 ring-ink/8 sm:grid-cols-2 sm:p-8">
      <label className="block sm:col-span-2">
        <span className="mb-2 block text-sm font-semibold">Organization name</span>
        <input name="name" required minLength={2} maxLength={120} placeholder="Northside Community Garden" className="min-h-12 w-full rounded-2xl border border-line bg-white px-4" />
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-2 block text-sm font-semibold">Short description</span>
        <textarea name="short_description" required minLength={12} maxLength={280} rows={3} placeholder="A fictional neighborhood garden for sandbox testing." className="w-full rounded-2xl border border-line bg-white px-4 py-3" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Category</span>
        <input name="category" required defaultValue="Community" className="min-h-12 w-full rounded-2xl border border-line bg-white px-4" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Country</span>
        <input name="country_code" required minLength={2} maxLength={2} defaultValue="US" className="min-h-12 w-full rounded-2xl border border-line bg-white px-4 uppercase" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Website (optional)</span>
        <input type="url" name="website_url" placeholder="https://example.org" className="min-h-12 w-full rounded-2xl border border-line bg-white px-4" />
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold">Brand color</span>
        <input type="color" name="brand_color" defaultValue="#74dfbd" className="h-12 w-full rounded-2xl border border-line bg-white p-2" />
      </label>
      <div className="sm:col-span-2"><FormMessage error={state.error} /></div>
      <div className="sm:col-span-2"><SubmitButton pendingLabel="Adding recipient…">Add fictional recipient</SubmitButton></div>
    </form>
  );
}
