import Handlebars from "handlebars";
import {
  OurImpact,
  type CampaignWidget,
  type CampaignWidgetStatus,
  type OurImpactEntitlement,
} from "@our-impact/browser";
import { formatEntitlementProgress } from "./format-progress";
import accountTemplateSource from "./templates/account.hbs?raw";
import authTemplateSource from "./templates/auth.hbs?raw";
import integrationErrorTemplateSource from "./templates/integration-error.hbs?raw";
import pageTemplateSource from "./templates/page.hbs?raw";
import profileTemplateSource from "./templates/profile.hbs?raw";
import "./styles.css";

type ShopUser = {
  id: string;
  externalUserId: string;
  email: string;
  displayName: string;
  createdAt: string;
};
type PublicConfig = { publishableKey: string; baseUrl: string };
type ShopConfig = { campaignEmbedUrl: string | null };
type IdentityResult = { token: string; expiresAt: string };
type AuthMode = "signup" | "signin";
type EntitlementView = { title: string; message: string; progressLabel: string };

const templates = {
  page: Handlebars.compile<{ campaignEmbedUrl: string | null }>(pageTemplateSource),
  account: Handlebars.compile(accountTemplateSource),
  auth: Handlebars.compile(authTemplateSource),
  profile: Handlebars.compile(profileTemplateSource),
  integrationError: Handlebars.compile(integrationErrorTemplateSource),
};

let currentUser: ShopUser | null = null;
let campaignEmbedUrl: string | null = null;
let ourImpact: OurImpact | null = null;
let campaignWidget: CampaignWidget | null = null;

void bootstrap();

async function bootstrap() {
  const shopConfig = await requestJson<ShopConfig>("/api/shop/config").catch(() => ({
    campaignEmbedUrl: null,
  }));
  campaignEmbedUrl = shopConfig.campaignEmbedUrl;
  render(document.querySelector<HTMLDivElement>("#app")!, templates.page, shopConfig);
  document.querySelector<HTMLButtonElement>("#refresh")!.addEventListener("click", () => void loadEntitlements());
  await mountCampaignWidget();
  await initializeAccount();
}

async function initializeAccount() {
  try {
    const { user } = await requestJson<{ user: ShopUser | null }>("/api/auth/session");
    currentUser = user;
  } catch {
    currentUser = null;
  }
  renderAccountControl();
  if (currentUser) await loadEntitlements();
  else renderAuthentication("signup");
}

function renderAccountControl() {
  const control = document.querySelector<HTMLDivElement>("#account-control")!;
  render(control, templates.account, currentUser
    ? { signedIn: true, displayName: currentUser.displayName, initials: initials(currentUser.displayName) }
    : { signedIn: false });

  if (!currentUser) {
    control.querySelector("#header-signin")!.addEventListener("click", () => {
      renderAuthentication("signin");
      document.querySelector("#community")?.scrollIntoView({ behavior: "smooth" });
    });
    return;
  }

  control.querySelector("#signout")!.addEventListener("click", () => void signOut());
}

function renderAuthentication(mode: AuthMode, errorMessage?: string) {
  document.documentElement.dataset.communityTheme = "standard";
  document.querySelector<HTMLButtonElement>("#refresh")!.hidden = true;
  document.querySelector("#welcome")!.textContent = mode === "signup" ? "Join Mike’s community." : "Welcome back.";
  document.querySelector("#community-description")!.textContent = "Mike keeps your account secure. Our Impact receives only a stable shop customer ID.";

  const panel = document.querySelector<HTMLDivElement>("#impact-panel")!;
  render(panel, templates.auth, {
    isSignup: mode === "signup",
    isSignin: mode === "signin",
    passwordAutocomplete: mode === "signup" ? "new-password" : "current-password",
    errorMessage,
    submitLabel: mode === "signup" ? "Create shop account" : "Sign in to Mike’s",
  });

  panel.querySelectorAll<HTMLButtonElement>("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () => renderAuthentication(button.dataset.authMode as AuthMode));
  });
  panel.querySelector<HTMLFormElement>("#auth-form")!.addEventListener("submit", (event) => void authenticate(event, mode));
}

async function authenticate(event: SubmitEvent, mode: AuthMode) {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const submit = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
  const error = form.querySelector<HTMLParagraphElement>("#auth-error")!;
  const data = new FormData(form);
  submit.disabled = true;
  submit.textContent = mode === "signup" ? "Creating account…" : "Signing in…";
  error.hidden = true;

  try {
    const result = await requestJson<{ user: ShopUser }>(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: data.get("displayName"),
        email: data.get("email"),
        password: data.get("password"),
      }),
    });
    currentUser = result.user;
    renderAccountControl();
    await loadEntitlements();
  } catch (caught) {
    error.textContent = authErrorMessage(caught);
    error.hidden = false;
    submit.disabled = false;
    submit.textContent = mode === "signup" ? "Create shop account" : "Sign in to Mike’s";
  }
}

async function signOut() {
  await requestJson("/api/auth/signout", { method: "POST" }).catch(() => undefined);
  ourImpact?.clearIdentity();
  setWidgetState("anonymous", "Sign in to connect rewards");
  currentUser = null;
  renderAccountControl();
  renderAuthentication("signin");
}

async function loadEntitlements() {
  if (!currentUser) return renderAuthentication("signin");
  const user = currentUser;
  const panel = document.querySelector<HTMLDivElement>("#impact-panel")!;
  document.querySelector<HTMLButtonElement>("#refresh")!.hidden = false;
  document.querySelector("#welcome")!.textContent = `Welcome back, ${user.displayName}.`;
  document.querySelector("#community-description")!.textContent = "Mike’s shop recognizes your verified community support through Our Impact.";
  panel.innerHTML = `<div class="loading-orb"></div><p>Loading your community perks…</p>`;

  try {
    const identity = await requestJson<IdentityResult>("/api/our-impact/identity", { method: "POST" });
    const impact = await ensureOurImpact();
    impact.setIdentity(identity.token);
    setWidgetState("connecting", "Connecting shop account…");
    renderEntitlements(panel, user, await impact.user.all());
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === "shop_authentication_required") {
      currentUser = null;
      renderAccountControl();
      return renderAuthentication("signin", "Your shop session expired. Sign in again.");
    }
    render(panel, templates.integrationError, { message: integrationErrorMessage(error) });
  }
}

function renderEntitlements(panel: HTMLDivElement, user: ShopUser, entitlements: OurImpactEntitlement[]) {
  const active = entitlements.filter(
    (item) => item.state === "active" && (!item.validUntil || item.validUntil > new Date()),
  );
  const hasTheme = active.some((item) => item.entitlementKey === "community_champion_theme");
  document.documentElement.dataset.communityTheme = hasTheme ? "champion" : "standard";
  const entitlementViews = active.map(entitlementView);

  render(panel, templates.profile, {
    initials: initials(user.displayName),
    displayName: user.displayName,
    email: user.email,
    externalUserId: user.externalUserId,
    hasEntitlements: entitlementViews.length > 0,
    entitlements: entitlementViews,
  });

  panel.querySelector("#copy-customer-id")!.addEventListener("click", async (event) => {
    await navigator.clipboard.writeText(user.externalUserId);
    (event.currentTarget as HTMLButtonElement).textContent = "Copied";
  });
}

function entitlementView(entitlement: OurImpactEntitlement): EntitlementView {
  const title = entitlement.entitlementKey
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
  const message = entitlement.entitlementKey === "community_champion_theme"
    ? "A warmer shop theme, unlocked by your community support."
    : `Active with ${entitlement.qualifyingCount} qualifying contribution${entitlement.qualifyingCount === 1 ? "" : "s"}.`;
  return {
    title,
    message,
    progressLabel: formatEntitlementProgress(entitlement.progressValue, entitlement.progressUnit),
  };
}

async function ensureOurImpact() {
  if (ourImpact) return ourImpact;
  const config = await requestJson<PublicConfig>("/api/our-impact/config");
  ourImpact = new OurImpact({ publishableKey: config.publishableKey, baseUrl: config.baseUrl });
  return ourImpact;
}

async function mountCampaignWidget() {
  if (!campaignEmbedUrl) return;
  try {
    const impact = await ensureOurImpact();
    const publicId = campaignPublicId(campaignEmbedUrl);
    campaignWidget?.destroy();
    campaignWidget = impact.widgets.mountCampaign({
      target: "#campaign-widget",
      publicId,
      height: "auto",
      minHeight: 420,
      borderRadius: 0,
      title: "Mike’s community voting campaign",
      onStatusChange: updateWidgetStatus,
      onDonationCompleted: () => {
        if (currentUser) void loadEntitlements();
      },
    });
  } catch {
    setWidgetState("error", "Campaign connection needs attention");
  }
}

function campaignPublicId(embedUrl: string) {
  const match = new URL(embedUrl).pathname.match(/^\/embed\/([^/]+)\/?$/);
  if (!match) throw new Error("The campaign embed URL is invalid.");
  return decodeURIComponent(match[1]);
}

function updateWidgetStatus(status: CampaignWidgetStatus) {
  if (status === "identified") return setWidgetState("connected", "Shop account connected");
  if (status === "anonymous") return setWidgetState("anonymous", "Sign in to connect rewards");
  if (status === "error") return setWidgetState("error", "Identity needs attention");
  setWidgetState("connecting", currentUser ? "Connecting shop account…" : "Loading community campaign…");
}

function setWidgetState(state: string, label: string) {
  const status = document.querySelector<HTMLElement>("#widget-identity-state");
  if (!status) return;
  status.dataset.state = state;
  status.textContent = label;
}

async function requestJson<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new ApiRequestError(body.error ?? `request_failed_${response.status}`, response.status);
  return body;
}

class ApiRequestError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "ApiRequestError";
  }
}

function authErrorMessage(error: unknown) {
  if (!(error instanceof ApiRequestError)) return "The account request could not be completed.";
  return {
    email_already_registered: "That email already has an account. Try signing in instead.",
    invalid_email_or_password: "The email or password is incorrect.",
    invalid_email: "Enter a valid email address.",
    password_must_be_8_to_128_characters: "Use a password between 8 and 128 characters.",
    display_name_must_be_2_to_80_characters: "Use a display name between 2 and 80 characters.",
  }[error.code] ?? "The account request could not be completed.";
}

function integrationErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError && error.code === "missing_our_impact_configuration") {
    return "The server still needs its Our Impact publishable and secret keys.";
  }
  if (error instanceof ApiRequestError && error.code === "identity_token_failed") {
    return "Mike’s server could not create an Our Impact identity. Check the full server secret.";
  }
  if (error instanceof Error && error.message.includes("origin_not_allowed")) {
    return "This browser origin is not allowed by the Our Impact developer project.";
  }
  return error instanceof Error ? error.message : "The community profile could not be loaded.";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function render<T>(element: HTMLElement, template: Handlebars.TemplateDelegate<T>, context: T) {
  element.innerHTML = template(context);
}
