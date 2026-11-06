"use client";

import { useEffect } from "react";

type IdentifyMessage = {
  type: "our-impact.identify";
  token: string;
};

type ClearIdentityMessage = {
  type: "our-impact.clear-identity";
};

function isIdentifyMessage(value: unknown): value is IdentifyMessage {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { type?: unknown }).type === "our-impact.identify" &&
      typeof (value as { token?: unknown }).token === "string",
  );
}

function isClearIdentityMessage(value: unknown): value is ClearIdentityMessage {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as { type?: unknown }).type === "our-impact.clear-identity",
  );
}

export function WidgetIdentityBridge({ publicId }: { publicId: string }) {
  useEffect(() => {
    function reply(targetOrigin: string, message: object) {
      window.parent.postMessage(message, targetOrigin);
    }

    async function onMessage(event: MessageEvent<unknown>) {
      if (event.source !== window.parent) return;
      try {
        if (isClearIdentityMessage(event.data)) {
          const response = await fetch(
            `/api/campaigns/${encodeURIComponent(publicId)}/identity`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ parentOrigin: event.origin }),
            },
          );
          reply(event.origin, {
            type: response.ok
              ? "our-impact.identity-cleared"
              : "our-impact.identity-error",
          });
          return;
        }
        if (!isIdentifyMessage(event.data)) return;
        const response = await fetch(
          `/api/campaigns/${encodeURIComponent(publicId)}/identity`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: event.data.token,
              parentOrigin: event.origin,
            }),
          },
        );
        const result = (await response.json()) as {
          message?: string;
          externalUserId?: string;
        };
        reply(event.origin, {
          type: response.ok
            ? "our-impact.identified"
            : "our-impact.identity-error",
          externalUserId: result.externalUserId,
          message: result.message,
        });
      } catch {
        reply(event.origin, {
          type: "our-impact.identity-error",
          message: "The widget could not reach the identity service.",
        });
      }
    }

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: "our-impact.ready" }, "*");
    return () => window.removeEventListener("message", onMessage);
  }, [publicId]);

  return null;
}
