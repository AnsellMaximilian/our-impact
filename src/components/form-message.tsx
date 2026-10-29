import { CircleAlert, CircleCheck } from "lucide-react";

export function FormMessage({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  if (!error && !message) return null;

  return (
    <div
      role={error ? "alert" : "status"}
      className={
        error
          ? "flex items-start gap-2 rounded-2xl bg-coral/10 px-4 py-3 text-sm text-coral-dark ring-1 ring-coral/25"
          : "flex items-start gap-2 rounded-2xl bg-mint/15 px-4 py-3 text-sm text-mint-dark ring-1 ring-mint/35"
      }
    >
      {error ? (
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : (
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      )}
      <span>{error ?? message}</span>
    </div>
  );
}
