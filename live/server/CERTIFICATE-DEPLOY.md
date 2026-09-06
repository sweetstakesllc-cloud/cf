# Certificate service deployment

Prepared locally; not deployed. This uses `src/certificates/index.ts`, a
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

The currently installed app has product/theme/content permissions, but no order
permissions. Add `read_orders` and `write_orders` to its configuration and approve
the updated installation. Verify access to the customer email field required by
the webhook. Configure and verify the Resend sending domain's DNS records.

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
Hosting and securely configuring a Resend sending API key remain outstanding.
