import { OurImpact, type OurImpactEntitlement } from "@our-impact/browser";
import "./styles.css";

type DemoUser = { id: string; name: string; initials: string };
type PublicConfig = { publishableKey: string; baseUrl: string };
type IdentityResult = { token: string; expiresAt: string };

const users: DemoUser[] = [
  { id: "mikes-vegan-shop:jamie", name: "Jamie", initials: "JM" },
  { id: "mikes-vegan-shop:alex", name: "Alex", initials: "AL" },
  { id: "mikes-vegan-shop:riley", name: "Riley", initials: "RL" },
];
const storageKey = "mikes-vegan-shop:user";
let selectedUser = users.find((user) => user.id === localStorage.getItem(storageKey)) ?? users[0];

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <header class="site-header">
    <a class="brand" href="#"><span class="brand-mark">M</span><span>Mike’s Vegan Shop</span></a>
    <div class="profile-control">
      <label for="supporter">Viewing as</label>
      <select id="supporter">
        ${users.map((user) => `<option value="${user.id}">${user.name}</option>`).join("")}
      </select>
    </div>
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
        <h2 id="welcome">Welcome back, ${selectedUser.name}.</h2>
        <p>Mike’s shop recognizes your verified community support through Our Impact.</p>
      </div>
      <button class="refresh-button" id="refresh" type="button">Refresh perks</button>
      <div class="impact-panel" id="impact-panel" aria-live="polite">
        <div class="loading-orb"></div><p>Loading ${selectedUser.name}’s community perks…</p>
      </div>
    </section>
  </main>
  <footer><span>Mike’s Vegan Shop · Duluth, MN</span><span>Community perks verified by <strong>Our Impact</strong></span></footer>
`;

const select = document.querySelector<HTMLSelectElement>("#supporter")!;
select.value = selectedUser.id;
select.addEventListener("change", () => {
  selectedUser = users.find((user) => user.id === select.value) ?? users[0];
  localStorage.setItem(storageKey, selectedUser.id);
  document.querySelector("#welcome")!.textContent = `Welcome back, ${selectedUser.name}.`;
  void loadEntitlements();
});
document.querySelector("#refresh")!.addEventListener("click", () => void loadEntitlements());

void loadEntitlements();

async function loadEntitlements() {
  const panel = document.querySelector<HTMLDivElement>("#impact-panel")!;
  panel.innerHTML = `<div class="loading-orb"></div><p>Loading ${selectedUser.name}’s community perks…</p>`;

  try {
    const configResponse = await fetch("/api/our-impact/config");
    if (!configResponse.ok) throw new Error("This demo still needs its Our Impact environment variables.");
    const config = (await configResponse.json()) as PublicConfig;

    const identityResponse = await fetch("/api/our-impact/identity", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ externalUserId: selectedUser.id }),
    });
    if (!identityResponse.ok) throw new Error("Mike’s server could not create a supporter identity.");
    const identity = (await identityResponse.json()) as IdentityResult;

    const ourImpact = new OurImpact({
      publishableKey: config.publishableKey,
      userToken: identity.token,
      baseUrl: config.baseUrl,
    });
    renderEntitlements(panel, await ourImpact.user.all());
  } catch (error) {
    panel.innerHTML = `
      <div class="setup-message">
        <span>Setup needed</span>
        <h3>Connect Mike’s shop to its Our Impact project</h3>
        <p>${error instanceof Error ? error.message : "The community profile could not be loaded."}</p>
        <code>Copy .env.example to .env.local</code>
      </div>`;
  }
}

function renderEntitlements(panel: HTMLDivElement, entitlements: OurImpactEntitlement[]) {
  const active = entitlements.filter(
    (item) => item.state === "active" && (!item.validUntil || item.validUntil > new Date()),
  );
  const hasTheme = active.some((item) => item.entitlementKey === "community_champion_theme");
  document.documentElement.dataset.communityTheme = hasTheme ? "champion" : "standard";

  panel.innerHTML = `
    <div class="profile-summary">
      <span class="avatar">${selectedUser.initials}</span>
      <div><p>Community member</p><h3>${selectedUser.name}</h3></div>
      <span class="verified">✓ Verified</span>
    </div>
    <div class="perk-grid">
      ${
        active.length
          ? active.map(entitlementCard).join("")
          : `<div class="empty-state"><h3>Your next perk starts here</h3><p>Vote or donate through Mike’s next community campaign, then refresh this profile.</p></div>`
      }
    </div>`;
}

function entitlementCard(entitlement: OurImpactEntitlement) {
  const title = entitlement.entitlementKey
    .split("_")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
  const message = entitlement.entitlementKey === "community_champion_theme"
    ? "A warmer shop theme, unlocked by your community support."
    : `Active with ${entitlement.qualifyingCount} qualifying contribution${entitlement.qualifyingCount === 1 ? "" : "s"}.`;
  return `<article class="perk-card"><span class="perk-status">Active</span><h3>${title}</h3><p>${message}</p><small>${entitlement.progressValue} ${entitlement.progressUnit}</small></article>`;
}
