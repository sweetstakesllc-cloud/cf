# Certificate service deployment

Deployed on Render on 2026-09-06. This uses `src/certificates/index.ts`, a
certificate-only entry point that does not need Stripe or expose auction routes.
The combined live-server entry point can also run certificate automation.

## Hosting

Create a paid Render Docker web service connected to this repository and branch,
with root directory `live/server` and Dockerfile `Dockerfile`. Use one instance,
a persistent disk mounted at `/data`, and health check path `/health`.
Create managed PostgreSQL in the same region and use its internal connection URL.
Review the provider's recurring charges before provisioning.

Set these environment variables through the hosting dashboard (never Git):

- `DATABASE_URL`: managed PostgreSQL connection URL.
- `SHOPIFY_STORE_DOMAIN`: `ef7144.myshopify.com`.
- `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`: installed Shopify app credentials.
- `SHOPIFY_WEBHOOK_SECRET`: signing secret for the subscription method used.
  App API subscriptions use the app client secret; admin-created webhooks use
  the signing secret shown by Shopify for those webhooks.
- `PUBLIC_BASE_URL`: the final HTTPS service URL, without a trailing slash.
- `RESEND_API_KEY`: a sending key from the store's Resend account.
- `CERTIFICATE_FROM_EMAIL`: `Circular Fash <certificates@circularfash.com>`
  after verifying that sending domain in Resend.

The Docker image sets the Python interpreter and `/data/certificates` storage
directory. Startup applies database migrations. Shopify client credentials are
exchanged automatically and cached until one minute before token expiry.

## Shopify and email

The installed app now has `read_orders` and `write_orders`, confirmed by the
Admin API after releasing `certificates-orders-2026-09-06` and accepting the
updated installation. Shopify displayed the required customer data access during
that update. Resend has verified the sending domain. Confirm the customer email
field with a controlled fulfillment test before enabling normal processing.

Only after the backend is healthy, register `orders/fulfilled` JSON delivery to
`https://SERVICE_HOST/webhooks/shopify/orders-fulfilled`.

Before considering the service live, use an explicitly designated test order
and controlled recipient. Check the webhook is accepted, its database job finishes,
the PDF and verification page load, the order's
`custom.authenticity_certificates` metafield is written, and one email arrives.
Replay the same webhook and confirm no duplicate certificate or email. Restart
the service and confirm the PDF remains available. Configure database backups
and persistent-disk recovery in the hosting account.

## Local verification

`npm run tsc`

`node --import tsx --test scripts/check-shopify-token.ts`

The full `npm test` suite additionally requires the PostgreSQL test database
described in README.md and platform-compatible Vitest dependencies.

## Sending DNS configured — 2026-09-06

Added `circularfash.com` in Resend (Ireland region) and saved its generated
sending records through Shopify-managed DNS:

- TXT `resend._domainkey`: Resend-generated public DKIM key.
- CNAME `rsend`: `rsend-euw1.forge.rmta.net`.
- CNAME `send`: `send.forge.rmta.net`.

All three exact values were confirmed in Shopify and public DNS. Resend
verification completed successfully. Existing Google MX, root SPF, DMARC,
and other sender records were preserved; Resend receiving was not enabled.
A domain-limited Resend sending API key has been created and securely staged
locally for deployment; its value is not stored in Git.

## Live deployment — 2026-09-06

- Public base URL: `https://certificates.circularfash.com`.
- Render service: `srv-daequev40ujc738cn7cg`, Starter, Frankfurt.
- Database: `dpg-daeqtov40ujc738ck94g-a`, Basic-256mb, PostgreSQL 18,
  1 GB, Frankfurt; external PostgreSQL traffic blocked.
- Persistent disk: 1 GB at `/data`; PDFs in `/data/certificates`.
- Blueprint: `exs-daeqpreq1p3s73ah0ss0`, branch `deploy/certificates`.
- Runtime commit: `469a32e`; automatic code deployments are off.
- Shopify `ORDERS_FULFILLED` subscription:
  `gid://shopify/WebhookSubscription/2318272201032` targeting
  `https://certificates.circularfash.com/webhooks/shopify/orders-fulfilled`.
- Shopify DNS: CNAME `certificates` to `cf-certificates.onrender.com`.
- Real credentials configured in Render, including domain-limited Resend
  sending access. No secrets are committed to Git.

The custom HTTPS `/health` endpoint returns 200 and confirms database access.
Unsigned webhook requests are rejected. A hosted synthetic test generated a
5,107-byte PDF, reused its certificate on repeated processing, and served both
PDF and verification page over HTTPS. Its record is deliberately marked revoked
and labeled TEST ONLY. Shopify metadata writes and email were mocked for this
synthetic test: **real email delivery and a real Shopify test-order round trip
remain unverified**, pending a user-controlled test recipient.

The synthetic test token is `bd6d5939-06fd-46ce-8a74-19ae00e28549`.
No customer email was sent during deployment testing. The fulfillment webhook
is registered, so new fulfilled orders are enabled for automatic processing.
Historical orders are not backfilled by this deployment.

Render shows three-day point-in-time database recovery, initially initializing,
and daily disk snapshots retained for seven days. No restore drill or
post-restart persistence check has been performed yet. Watch failed certificate
jobs and Render failure notifications; periodically test recovery.
