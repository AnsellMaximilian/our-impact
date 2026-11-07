import {
  CampaignWidget,
  type CampaignWidgetOptions,
} from "./campaign-widget.js";

export {
  CampaignWidget,
  type CampaignWidgetOptions,
  type CampaignWidgetStatus,
} from "./campaign-widget.js";

export type EntitlementState = "active" | "inactive";

export type OurImpactEntitlement = {
  entitlementKey: string;
  state: EntitlementState;
  qualifyingCount: number;
  /** Count, or minor currency units when progressUnit is an ISO currency code. */
  progressValue: number;
  /** `events`, or a lowercase ISO 4217 currency code such as `usd`. */
  progressUnit: string;
  qualifiedAt: Date | null;
  validUntil: Date | null;
  updatedAt: Date;
};

export type OurImpactUser = {
  externalUserId: string;
  displayName: string | null;
};

export type OurImpactUserState = {
  user: OurImpactUser;
  entitlements: OurImpactEntitlement[];
};

export type OurImpactOptions = {
  /** Safe, public project key. Never put an `oi_sk_*` secret key in a browser. */
  publishableKey: string;
  /** Short-lived token created by `@our-impact/node` on your server. Omit it for an anonymous campaign widget. */
  userToken?: string;
  /** Defaults to the hosted Our Impact API. */
  baseUrl?: string;
  /** Custom fetch implementation, primarily useful in tests and non-browser runtimes. */
  fetch?: typeof globalThis.fetch;
  /** Time source used when evaluating entitlement expiry. */
  now?: () => Date;
};

type WireEntitlement = {
  entitlement_key: string;
  state: EntitlementState;
  qualifying_count: number;
  progress_value: number;
  progress_unit: string;
  qualified_at: string | null;
  valid_until: string | null;
  updated_at: string;
};

type WireUserState = {
  user: {
    external_user_id: string;
    display_name: string | null;
  };
  entitlements: WireEntitlement[];
};

export class OurImpactError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "OurImpactError";
  }
}

export class OurImpact {
  readonly #publishableKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  #userToken: string | null;
  #cachedState: Promise<OurImpactUserState> | null = null;
  #campaignWidgets = new Set<CampaignWidget>();

  constructor(options: OurImpactOptions) {
    if (!options.publishableKey.startsWith("oi_pk_")) {
      throw new Error("Our Impact publishableKey must start with `oi_pk_`.");
    }
    this.#publishableKey = options.publishableKey;
    this.#userToken = options.userToken ?? null;
    this.#baseUrl = (options.baseUrl ?? "https://our-impact.vercel.app").replace(/\/$/, "");
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#now = options.now ?? (() => new Date());
  }

  /** Change the signed-in host user without creating a new SDK instance. */
  setIdentity(userToken: string) {
    if (!userToken) throw new Error("Our Impact userToken is required.");
    this.#userToken = userToken;
    this.clearCache();
    this.#campaignWidgets.forEach((widget) => widget.setIdentity(userToken));
    return this;
  }

  /** Return mounted campaign widgets to their public, anonymous state. */
  clearIdentity() {
    this.#userToken = null;
    this.clearCache();
    this.#campaignWidgets.forEach((widget) => widget.clearIdentity());
    return this;
  }

  clearCache() {
    this.#cachedState = null;
  }

  async refresh() {
    this.clearCache();
    return this.#load();
  }

  readonly user = {
    is: (entitlementKey: string) => this.#is(entitlementKey),
    get: (entitlementKey: string) => this.#get(entitlementKey),
    all: () => this.#all(),
    profile: () => this.#profile(),
  };

  readonly widgets = {
    mountCampaign: (options: CampaignWidgetOptions) => this.#mountCampaign(options),
  };

  #mountCampaign(options: CampaignWidgetOptions) {
    let widget: CampaignWidget;
    widget = new CampaignWidget(options, {
      baseUrl: this.#baseUrl,
      userToken: this.#userToken,
      onDonationCompleted: async () => {
        if (this.#userToken) await this.refresh();
      },
      onDestroy: () => this.#campaignWidgets.delete(widget),
    });
    this.#campaignWidgets.add(widget);
    return widget;
  }

  async #is(entitlementKey: string) {
    const entitlement = await this.#get(entitlementKey);
    return Boolean(
      entitlement &&
        entitlement.state === "active" &&
        (!entitlement.validUntil || entitlement.validUntil > this.#now()),
    );
  }

  async #get(entitlementKey: string) {
    const { entitlements } = await this.#load();
    return entitlements.find((item) => item.entitlementKey === entitlementKey) ?? null;
  }

  async #all() {
    return (await this.#load()).entitlements;
  }

  async #profile() {
    return (await this.#load()).user;
  }

  #load() {
    return (this.#cachedState ??= this.#request().catch((error) => {
      this.#cachedState = null;
      throw error;
    }));
  }

  async #request(): Promise<OurImpactUserState> {
    if (!this.#userToken) {
      throw new Error("Our Impact userToken is required for user entitlement queries.");
    }
    const response = await this.#fetch(`${this.#baseUrl}/api/v1/me/entitlements`, {
      headers: {
        authorization: `Bearer ${this.#userToken}`,
        "x-our-impact-key": this.#publishableKey,
      },
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      const code = body?.error;
      throw new OurImpactError(
        code ? `Our Impact request failed: ${code}.` : `Our Impact request failed (${response.status}).`,
        response.status,
        code,
      );
    }

    return mapUserState((await response.json()) as WireUserState);
  }
}

function mapUserState(state: WireUserState): OurImpactUserState {
  return {
    user: {
      externalUserId: state.user.external_user_id,
      displayName: state.user.display_name,
    },
    entitlements: state.entitlements.map((entitlement) => ({
      entitlementKey: entitlement.entitlement_key,
      state: entitlement.state,
      qualifyingCount: entitlement.qualifying_count,
      progressValue: entitlement.progress_value,
      progressUnit: entitlement.progress_unit,
      qualifiedAt: parseNullableDate(entitlement.qualified_at),
      validUntil: parseNullableDate(entitlement.valid_until),
      updatedAt: new Date(entitlement.updated_at),
    })),
  };
}

function parseNullableDate(value: string | null) {
  return value ? new Date(value) : null;
}
