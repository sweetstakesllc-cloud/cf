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

### Certificate image selection (7 September 2026)

New certificates use the first listing photograph and the final two photographs, where tag/label details are normally listed. Duplicate URLs are removed for short galleries. Shopify images are paginated so the actual end of a gallery is used. Both the PDF and verification page consume this saved selection. Existing certificates retain their original snapshots.

Validation: six image-selection regression tests, TypeScript checking, a real Shopify product read, and a rendered sample with buckle and stamped label details.

## Past-order certificate requests — 8 September 2026

Customers can use `/request` with their order number and checkout email. The form returns the same acknowledgement regardless of order existence. Matching, paid, fulfilled, uncancelled single-quantity items are generated or reused and emailed only to the order email. Refunded, removed, missing-product, revoked-certificate and other exceptional cases require review. No fulfillment status is changed. The three selected listing images include the first photo and final two photos.

Requests and rate limits persist in PostgreSQL (migration 010). Concurrent submissions are deduplicated; delivery retries reuse a per-request Resend idempotency key. Requests are limited per hashed client IP and normalized email. The service trusts only its immediate reverse proxy; confirm client IP handling if the proxy topology changes.

The app currently lacks `read_all_orders`, so orders outside Shopify's default 60-day read window are queued for manual review. Request that scope through Shopify's access-request process to allow automatic historical matching. No customer passwords or browser sessions are stored in the service.

Review requests trigger an email to the shop's configured `shop.email`, containing the order number, supplied email and request ID. Staff must verify the order and email in Shopify. The public form never reveals certificate links. Review notification retries are durable and bounded; inspect pending review records if delivery fails.

Inside the Render service, list pending review requests:

```sh
node --import tsx scripts/certificate-requests.ts list
```

For an inaccessible historical order, retrieve its JSON from the authenticated Shopify admin: `/store/ef7144/orders/ORDER_ID.json`. Save it in the service temporarily. Use only an export retrieved by staff from Shopify, never a customer-provided file. To issue and email a verified request:

```sh
node --import tsx scripts/certificate-requests.ts issue REQUEST_ID /tmp/trusted-order.json
```

The command verifies order number, checkout email, paid/fulfilled status and line items before issuing. It does not override eligibility checks. Remove the temporary export after processing. Customers whose email does not match need to contact staff; do not alter the request email to bypass verification.

Validation: 11 request tests, 10 existing certificate/image tests, TypeScript checking, a real read-only Shopify eligibility lookup, and a mobile browser form submission against an isolated local database. Email deliveries were mocked; no customer or staff test emails were sent.
