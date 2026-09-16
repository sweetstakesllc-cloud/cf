# Certificate delivery after payment — 16 September 2026

The merchant approved sending certificates when customers pay, before shipment,
in a separate email titled `Certificate of Authenticity – Order #1234`.

## Changes

- Accept HMAC-verified `orders/paid` webhooks on `/webhooks/shopify/orders-paid`.
- Retain fulfillment delivery as a fallback for earlier orders, requiring a
  paid, uncancelled payload for either event.
- Paid customer requests no longer wait for fulfillment. Matching checkout
  email, cancellation, product quantities and revoked certificates remain checked.
- Record successful request delivery on the certificate rows so shipment does
  not trigger a second automatic email.
- One separate email per order contains each unit's individual PDF link.
- Update the request form and acknowledgement to describe delivery after payment.

## Customer #3550

Verified the order was paid, unfulfilled, uncancelled and matched the request's
checkout email. Generated its existing requested certificate without changing
fulfillment status or emailing during generation. The PDF returned HTTP 200.
The download link was provided to the merchant while the update was prepared.

## Validation

All 46 certificate regression tests pass, including paid delivery before shipment,
multi-unit orders, webhook replay followed by fulfillment, request delivery followed
by webhooks, unpaid/refunded/cancelled orders, provider failures, image selection,
PDF time limits and preservation of issued certificates. TypeScript checking and
`git diff --check` pass.

## Production rollout

Deployed commit `d01efef28b0021ef48a62ea1624c38e95b02000f` to the existing Render
service on 16 September. The deployment was started at 16:10:37 CEST and
reported success by 16:11:37 CEST.

[Render deployment](https://dashboard.render.com/web/srv-daequev40ujc738cn7cg/deploys/dep-dala6n61egvs73f22ia0).

Registered `ORDERS_PAID` subscription
`gid://shopify/WebhookSubscription/2324823507272` targeting
`https://certificates.circularfash.com/webhooks/shopify/orders-paid`.
Readback confirms both paid and the existing fulfilled subscription are present.
The configured webhook signing secret matches the installed app's secret.

Post-deployment checks: health and request form HTTP 200; updated paid-delivery
and email-subject text present; unsigned paid webhook rejected with HTTP 400;
#3550's 2,214,368-byte PDF remained accessible with HTTP 200 after restart.

Revalidated #3550 against Shopify and released its waiting request. The worker
recorded `sent` at **14:13:39 UTC**, with the certificate delivery timestamp set.
This confirms successful email-provider submission using the new subject,
not independently confirmed inbox delivery. No fulfillment status was changed.
The queue now has three sent requests and the same three inaccessible older
requests awaiting review.

## Remaining limitation

The older requests #2294, #2784 and #2663 still require access to orders beyond
Shopify's default read window. This payment-trigger change does not grant
`read_all_orders`. The sending-only Resend key cannot inspect inbox delivery or
bounces, so successful submission must not be described as confirmed receipt.
