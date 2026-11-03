"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";

type AuthNotice = {
  title: string;
  message: string;
};

function subscribeToHashChange(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function currentHash() {
  return window.location.hash;
}

function serverHash() {
  return "";
}

function noticeForAuthError(
  error: string | null,
  errorCode: string | null,
): AuthNotice | null {
  if (errorCode === "otp_expired") {
    return {
      title: "That secure link has already been used or expired.",
      message:
        "Email links work once. Return to the recipient invitation first—the earlier attempt may already have signed you in. If it still asks for verification, request a fresh link and open only the newest email.",
    };
  }

  if (error === "access_denied") {
    return {
      title: "We could not verify that email link.",
      message:
        "Return to the recipient invitation and request a new secure link, then open the newest message from the same browser you want to use for the recipient portal.",
    };
  }

  if (error === "confirmation") {
    return {
      title: "Email confirmation did not finish.",
      message:
        "Return to the recipient invitation and request a fresh secure link. Each link can only be used once.",
    };
  }

  return null;
}

export function AuthFeedback({
  fallbackError,
  nextPath,
}: {
  fallbackError?: string;
  nextPath: string;
}) {
  const hash = useSyncExternalStore(
    subscribeToHashChange,
    currentHash,
    serverHash,
  );
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const notice =
    noticeForAuthError(
      fragment.get("error") ?? fallbackError ?? null,
      fragment.get("error_code"),
    ) ?? noticeForAuthError(fallbackError ?? null, null);

  useEffect(() => {
    if (hash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, [hash]);

  if (!notice) return null;

  return (
    <div
      role="alert"
      className="mb-5 rounded-3xl border border-coral/35 bg-coral/10 p-5 text-ink"
    >
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-coral-dark" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">{notice.title}</h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">{notice.message}</p>
          {nextPath !== "/dashboard" && (
            <Link
              href={nextPath}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/90"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              Return to recipient invitation
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

