"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export function OurImpactCampaignEmbed({
  src,
  title,
  userToken,
  shopperName,
}: {
  src: string;
  title: string;
  userToken: string;
  shopperName: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [identityState, setIdentityState] = useState<
    "connecting" | "identified" | "error"
  >("connecting");
  const targetOrigin = useMemo(
    () => (typeof window === "undefined" ? "" : new URL(src, window.location.href).origin),
    [src],
  );

  useEffect(() => {
    function identify() {
      if (!targetOrigin) return;
      iframeRef.current?.contentWindow?.postMessage(
        { type: "our-impact.identify", token: userToken },
        targetOrigin,
      );
    }

    function onMessage(event: MessageEvent<unknown>) {
      if (
        event.origin !== targetOrigin ||
        event.source !== iframeRef.current?.contentWindow ||
        !event.data ||
        typeof event.data !== "object"
      ) {
        return;
      }
      const type = (event.data as { type?: unknown }).type;
      if (type === "our-impact.ready") identify();
      if (type === "our-impact.identified") setIdentityState("identified");
      if (type === "our-impact.identity-error") setIdentityState("error");
    }

    window.addEventListener("message", onMessage);
    identify();
    return () => window.removeEventListener("message", onMessage);
  }, [targetOrigin, userToken]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <p className="font-semibold text-[#55705d]">
          Embedded campaign: {title}
        </p>
        <span
          className={
            identityState === "identified"
              ? "rounded-full bg-[#dff5e8] px-3 py-1 font-semibold text-[#246443]"
              : identityState === "error"
                ? "rounded-full bg-[#ffe2d8] px-3 py-1 font-semibold text-[#8c3d25]"
                : "rounded-full bg-[#edf4e8] px-3 py-1 font-semibold text-[#55705d]"
          }
        >
          {identityState === "identified"
            ? `${shopperName} connected`
            : identityState === "error"
              ? "Identity needs attention"
              : "Connecting shopper…"}
        </span>
      </div>
      <iframe
        ref={iframeRef}
        title={title}
        src={src}
        onLoad={() => {
          setIdentityState("connecting");
          if (!targetOrigin) return;
          iframeRef.current?.contentWindow?.postMessage(
            { type: "our-impact.identify", token: userToken },
            targetOrigin,
          );
        }}
        className="h-[40rem] w-full rounded-3xl border border-[#d8e2d4] bg-white"
      />
    </div>
  );
}
