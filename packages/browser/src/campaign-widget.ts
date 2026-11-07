export type CampaignWidgetStatus =
  | "loading"
  | "ready"
  | "identified"
  | "anonymous"
  | "error";

export type CampaignWidgetOptions = {
  /** Element, or selector for an element, that will own the iframe. */
  target: HTMLElement | string;
  /** Public campaign id from the campaign embed URL. */
  publicId: string;
  /** Accessible iframe title. */
  title?: string;
  /** Auto-resize by default. Pass a number for a fixed, scrollable viewport. */
  height?: "auto" | number;
  /** Initial and minimum auto-height in pixels. @default 420 */
  minHeight?: number;
  /** Optional auto-height ceiling. Content scrolls after this height. */
  maxHeight?: number;
  /** Border radius applied to the iframe. @default 24 */
  borderRadius?: number;
  /** Added to the generated iframe. */
  className?: string;
  onStatusChange?: (status: CampaignWidgetStatus) => void;
  /** Runs after the SDK refreshes entitlements following a completed donation. */
  onDonationCompleted?: () => void;
};

type CampaignWidgetHost = {
  baseUrl: string;
  userToken: string | null;
  onDonationCompleted: () => Promise<void>;
  onDestroy: () => void;
};

type WidgetMessage = {
  type?: string;
  height?: number;
};

export class CampaignWidget {
  readonly element: HTMLIFrameElement;
  #userToken: string | null;
  #status: CampaignWidgetStatus = "loading";
  #destroyed = false;

  constructor(
    readonly options: CampaignWidgetOptions,
    readonly host: CampaignWidgetHost,
  ) {
    const target = resolveTarget(options.target);
    const minHeight = Math.max(240, options.minHeight ?? 420);
    const fixedHeight = typeof options.height === "number"
      ? Math.max(240, options.height)
      : null;

    this.#userToken = host.userToken;
    this.element = document.createElement("iframe");
    this.element.src = `${host.baseUrl}/embed/${encodeURIComponent(options.publicId)}`;
    this.element.title = options.title ?? "Our Impact community campaign";
    this.element.loading = "eager";
    this.element.allow = "payment; clipboard-write";
    this.element.className = options.className ?? "";
    this.element.style.display = "block";
    this.element.style.width = "100%";
    this.element.style.height = `${fixedHeight ?? minHeight}px`;
    this.element.style.border = "0";
    this.element.style.borderRadius = `${Math.max(0, options.borderRadius ?? 24)}px`;
    this.element.style.background = "transparent";
    this.element.style.transition = "height 180ms ease";
    this.element.scrolling = fixedHeight === null ? "no" : "auto";

    window.addEventListener("message", this.#receive);
    target.replaceChildren(this.element);
  }

  get status() {
    return this.#status;
  }

  setIdentity(userToken: string) {
    if (!userToken) throw new Error("Our Impact userToken is required.");
    this.#userToken = userToken;
    this.#identify();
  }

  clearIdentity() {
    this.#userToken = null;
    this.element.contentWindow?.postMessage(
      { type: "our-impact.clear-identity" },
      this.host.baseUrl,
    );
  }

  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;
    window.removeEventListener("message", this.#receive);
    this.element.remove();
    this.host.onDestroy();
  }

  #setStatus(status: CampaignWidgetStatus) {
    this.#status = status;
    this.options.onStatusChange?.(status);
  }

  #identify() {
    if (!this.#userToken) {
      this.#setStatus("anonymous");
      return;
    }
    this.element.contentWindow?.postMessage(
      { type: "our-impact.identify", token: this.#userToken },
      this.host.baseUrl,
    );
  }

  #resize(requestedHeight: number) {
    if (this.options.height !== undefined && this.options.height !== "auto") return;
    if (!Number.isFinite(requestedHeight) || requestedHeight <= 0) return;
    const minHeight = Math.max(240, this.options.minHeight ?? 420);
    const maxHeight = this.options.maxHeight
      ? Math.max(minHeight, this.options.maxHeight)
      : Number.POSITIVE_INFINITY;
    const nextHeight = Math.min(Math.max(Math.ceil(requestedHeight), minHeight), maxHeight);
    this.element.style.height = `${nextHeight}px`;
    this.element.scrolling = requestedHeight > maxHeight ? "auto" : "no";
  }

  #receive = (event: MessageEvent<WidgetMessage>) => {
    if (
      this.#destroyed ||
      event.origin !== this.host.baseUrl ||
      event.source !== this.element.contentWindow
    ) {
      return;
    }

    if (event.data?.type === "our-impact.resize") {
      this.#resize(event.data.height ?? 0);
      return;
    }
    if (event.data?.type === "our-impact.ready") {
      this.#setStatus("ready");
      this.#identify();
      return;
    }
    if (event.data?.type === "our-impact.identified") {
      this.#setStatus("identified");
      return;
    }
    if (event.data?.type === "our-impact.identity-cleared") {
      this.#setStatus("anonymous");
      return;
    }
    if (event.data?.type === "our-impact.identity-error") {
      this.#setStatus("error");
      return;
    }
    if (event.data?.type === "our-impact.donation-completed") {
      void this.host.onDonationCompleted().then(() => {
        this.options.onDonationCompleted?.();
      }).catch(() => this.#setStatus("error"));
    }
  };
}

function resolveTarget(target: HTMLElement | string) {
  if (typeof target !== "string") return target;
  const element = document.querySelector<HTMLElement>(target);
  if (!element) {
    throw new Error(`Our Impact campaign target was not found: ${target}`);
  }
  return element;
}
