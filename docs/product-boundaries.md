# Our Impact product boundaries

This document records the principal product direction while the PRD remains a living guide. User-facing pages should express the useful action and outcome; implementation details belong here and in code comments.

## Parties

- **Program owner** — Mike or Mike’s marketing/operations team. They create campaigns, commit a budget, review the community’s vote, and explicitly approve each PayPal payment.
- **Recipient** — an organization such as Duluth Animal Shelter or Duluth Community Garden. Its representative accepts a private invitation and consents to receive payments through PayPal.
- **Supporter** — Mike’s customer. They vote in an embedded Our Impact widget and may receive host-site entitlements. They do not need an Our Impact account.
- **Developer** — Mike’s software team. They integrate the widget, identity token, entitlement API, and signed webhooks into Mike’s site.

## Money and consent

- Closing a voting period calculates an allocation. It is not permission to charge a payer.
- A program owner currently signs in to PayPal and explicitly approves every campaign-funding order.
- Recipient onboarding grants Our Impact the platform permissions needed to create checkout orders for that merchant. Our Impact never receives a recipient’s PayPal password or API secret.
- Payer authentication, payment credentials, risk checks, and approval remain inside PayPal.
- A campaign-funding order may contain several purchase units, but each unit names one consented recipient merchant and has its own capture result.
- Automatic future funding is out of scope until PayPal eligibility, a suitable billing agreement or saved-payment mandate, and explicit payer consent are validated. A scheduler alone is not authorization to move money.

## Product surface

- Campaign pages are for the program owner: voting progress, results, funding, and history.
- Recipient PayPal onboarding lives in the recipient portal, not in the program owner’s campaign workflow. The owner sees readiness only.
- The public widget is primarily a voting surface. Direct supporter contributions are an experiment and must not be confused with the program owner’s committed campaign budget.
- Entitlements belong to the host application’s users. Production identity should come from short-lived, application-signed identity tokens rather than browser-local identity.

## Provider and compliance boundary

The current implementation is a PayPal Sandbox validation of partner onboarding and multi-seller Orders v2. Sandbox success does not establish live charitable-payment approval. Before live use, confirm the merchant category, partner permissions, regional availability, multi-seller limits, disclosures, refunds, tax/receipting responsibilities, and any PayPal Giving Fund or regulated-charity requirements directly with PayPal.

## Legacy path

The early Payouts API experiment used the platform account to initiate payments and asked the program owner for a recipient email. It is retained in code and schema only as historical test evidence. It is not shown as the primary product flow and should not be extended for live use.
