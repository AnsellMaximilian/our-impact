export type OurImpactEntitlement = {
  entitlement_key: string;
  state: "active" | "inactive";
  qualifying_count: number;
  qualified_at: string | null;
  valid_until: string | null;
  updated_at: string;
};

export class OurImpact {
  private entitlements: OurImpactEntitlement[] | null = null;

  constructor(
    private readonly options: {
      publishableKey: string;
      userToken: string;
      baseUrl?: string;
    },
  ) {}

  private async load() {
    if (this.entitlements) return this.entitlements;
    const response = await fetch(`${this.options.baseUrl ?? ""}/api/v1/me/entitlements`, {
      headers: {
        authorization: `Bearer ${this.options.userToken}`,
        "x-our-impact-key": this.options.publishableKey,
      },
    });
    if (!response.ok) throw new Error(`Our Impact request failed (${response.status}).`);
    const result = (await response.json()) as { entitlements: OurImpactEntitlement[] };
    this.entitlements = result.entitlements;
    return this.entitlements;
  }

  readonly user = {
    is: (entitlement: string) => this.is(entitlement),
    all: () => this.all(),
  };

  async is(entitlement: string) {
    const now = Date.now();
    return (await this.load()).some(
      (item) =>
        item.entitlement_key === entitlement &&
        item.state === "active" &&
        (item.valid_until === null || new Date(item.valid_until).getTime() > now),
    );
  }

  async all() {
    return this.load();
  }
}
