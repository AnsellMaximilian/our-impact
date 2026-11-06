import { OurImpact, type OurImpactEntitlement } from "@our-impact/browser";
import "./styles.css";

type ShopUser = {
  id: string;
  externalUserId: string;
  email: string;
  displayName: string;
  createdAt: string;
};
type PublicConfig = { publishableKey: string; baseUrl: string };
type IdentityResult = { token: string; expiresAt: string };
type AuthMode = "signup" | "signin";

let currentUser: ShopUser | null = null;

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#"><span class="brand-mark">M</span><span>Mike’s Vegan Shop</span></a>
    <div class="account-control" id="account-control"><span class="account-loading">Checking account…</span></div>
  </header>
  <main>
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Good food. Strong neighborhoods.</p>
        <h1>Plant-powered groceries with a little more heart.</h1>
        <p class="lede">Every purchase helps Mike’s community choose where our monthly giving goes—from the Duluth Animal Shelter to the Community Garden.</p>
        <a class="primary-button" href="#community">See your community perks</a>
      </div>
      <div class="hero-card" aria-hidden="true">
        <span class="leaf leaf-one">◆</span><span class="leaf leaf-two">◆</span>
        <div class="produce">🥬</div>
        <p>Fresh this week</p><strong>Local kale bundle</strong>
      </div>
    </section>

    <section class="values" aria-label="Shop values">
      <article><span>01</span><h2>Locally rooted</h2><p>Independent growers and makers from around Duluth.</p></article>
      <article><span>02</span><h2>Community chosen</h2><p>Neighbors vote on the causes our giving supports.</p></article>
      <article><span>03</span><h2>Impact rewarded</h2><p>Your verified support unlocks meaningful shop experiences.</p></article>
    </section>

    <section class="community" id="community">
      <div>
        <p class="eyebrow">Your community profile</p>
        <h2 id="welcome">Join Mike’s community.</h2>
        <p id="community-description">Create a shop account to connect your verified support with member-only experiences.</p>
      </div>
      <button class="refresh-button" id="refresh" type="button" hidden>Refresh perks</button>
      <div class="impact-panel" id="impact-panel" aria-live="polite">
        <div class="loading-orb"></div><p>Checking your shop session…</p>
      </div>
    </section>
  </main>
  <footer><span>Mike’s Vegan Shop · Duluth, MN</span><span>Community perks verified by <strong>Our Impact</strong></span></footer>
`;

document.querySelector<HTMLButtonElement>("#refresh")!.addEventListener("click", () => void loadEntitlements());
void initialize();

async function initialize() {
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
  if (!currentUser) {
    control.innerHTML = `<button class="account-button" id="header-signin" type="button">Sign in</button>`;
    document.querySelector("#header-signin")!.addEventListener("click", () => {
      renderAuthentication("signin");
      document.querySelector("#community")?.scrollIntoView({ behavior: "smooth" });
    });
    return;
  }

  control.innerHTML = `
    <div class="account-chip">
      <span class="mini-avatar">${escapeHtml(initials(currentUser.displayName))}</span>
      <span><small>Signed in</small><strong>${escapeHtml(currentUser.displayName)}</strong></span>
      <button id="signout" type="button">Sign out</button>
    </div>`;
  document.querySelector("#signout")!.addEventListener("click", () => void signOut());
}

function renderAuthentication(mode: AuthMode, errorMessage?: string) {
  document.documentElement.dataset.communityTheme = "standard";
  document.querySelector<HTMLButtonElement>("#refresh")!.hidden = true;
  document.querySelector("#welcome")!.textContent = mode === "signup" ? "Join Mike’s community." : "Welcome back.";
  document.querySelector("#community-description")!.textContent = "Mike keeps your account secure. Our Impact receives only a stable shop customer ID.";

  const panel = document.querySelector<HTMLDivElement>("#impact-panel")!;
  panel.innerHTML = `
    <div class="auth-layout">
      <div class="auth-story">
        <span class="auth-kicker">Shop-owned identity</span>
        <h3>Your Mike’s account connects the dots.</h3>
        <p>Sign in once. Mike’s server confirms who you are, then asks Our Impact which community perks that customer has earned.</p>
        <ul><li>Your password stays with Mike’s shop.</li><li>Our Impact receives no password or shop session.</li><li>Your customer ID stays stable across visits.</li></ul>
      </div>
      <div class="auth-card">
        <div class="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" data-auth-mode="signup" class="${mode === "signup" ? "active" : ""}">Create account</button>
          <button type="button" data-auth-mode="signin" class="${mode === "signin" ? "active" : ""}">Sign in</button>
        </div>
        <form id="auth-form" class="auth-form">
          ${mode === "signup" ? `<label>Display name<input name="displayName" autocomplete="name" minlength="2" maxlength="80" required placeholder="Jamie" /></label>` : ""}
          <label>Email<input name="email" type="email" autocomplete="email" maxlength="254" required placeholder="jamie@example.com" /></label>
          <label>Password<input name="password" type="password" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" minlength="8" maxlength="128" required placeholder="At least 8 characters" /></label>
          <p class="auth-error" id="auth-error" ${errorMessage ? "" : "hidden"}>${escapeHtml(errorMessage ?? "")}</p>
          <button class="auth-submit" type="submit">${mode === "signup" ? "Create shop account" : "Sign in to Mike’s"}</button>
        </form>
      </div>
    </div>`;

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
  panel.innerHTML = `<div class="loading-orb"></div><p>Loading ${escapeHtml(user.displayName)}’s community perks…</p>`;

  try {
    const config = await requestJson<PublicConfig>("/api/our-impact/config");
    const identity = await requestJson<IdentityResult>("/api/our-impact/identity", { method: "POST" });
    const ourImpact = new OurImpact({
      publishableKey: config.publishableKey,
      userToken: identity.token,
      baseUrl: config.baseUrl,
    });
    renderEntitlements(panel, user, await ourImpact.user.all());
  } catch (error) {
    if (error instanceof ApiRequestError && error.code === "shop_authentication_required") {
      currentUser = null;
      renderAccountControl();
      return renderAuthentication("signin", "Your shop session expired. Sign in again.");
    }
    panel.innerHTML = `
      <div class="setup-message">
        <span>Integration setup needed</span>
        <h3>Connect Mike’s shop to its Our Impact project</h3>
        <p>${escapeHtml(integrationErrorMessage(error))}</p>
        <code>Check .env.local and allow http://localhost:4173</code>
      </div>`;
  }
}

function renderEntitlements(panel: HTMLDivElement, user: ShopUser, entitlements: OurImpactEntitlement[]) {
  const active = entitlements.filter(
    (item) => item.state === "active" && (!item.validUntil || item.validUntil > new Date()),
  );
  const hasTheme = active.some((item) => item.entitlementKey === "community_champion_theme");
  document.documentElement.dataset.communityTheme = hasTheme ? "champion" : "standard";

  panel.innerHTML = `
    <div class="profile-summary">
      <span class="avatar">${escapeHtml(initials(user.displayName))}</span>
      <div><p>Mike’s community member</p><h3>${escapeHtml(user.displayName)}</h3><span class="member-email">${escapeHtml(user.email)}</span></div>
      <span class="verified">✓ Shop session verified</span>
    </div>
    <div class="customer-id-row">
      <div><span>Stable shop customer ID</span><code>${escapeHtml(user.externalUserId)}</code></div>
      <button id="copy-customer-id" type="button">Copy ID</button>
    </div>
    <div class="perk-grid">
      ${
        active.length
          ? active.map(entitlementCard).join("")
          : `<div class="empty-state"><span class="empty-kicker">Integration test</span><h3>This account has no active perks yet.</h3><p>Copy the customer ID above. In Mike’s Our Impact project, open the Test console, send a <code>donation.completed</code> event for that ID, then return here and refresh perks.</p></div>`
      }
    </div>`;

  panel.querySelector("#copy-customer-id")!.addEventListener("click", async (event) => {
    await navigator.clipboard.writeText(user.externalUserId);
    (event.currentTarget as HTMLButtonElement).textContent = "Copied";
  });
}

function entitlementCard(entitlement: OurImpactEntitlement) {
  const title = entitlement.entitlementKey
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
  const message = entitlement.entitlementKey === "community_champion_theme"
    ? "A warmer shop theme, unlocked by your community support."
    : `Active with ${entitlement.qualifyingCount} qualifying contribution${entitlement.qualifyingCount === 1 ? "" : "s"}.`;
  return `<article class="perk-card"><span class="perk-status">Active</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p><small>${entitlement.progressValue} ${escapeHtml(entitlement.progressUnit)}</small></article>`;
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

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character]!);
}
