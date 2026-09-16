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

## Deployment steps

Deploy the tested code to the existing Render service, then register the
`ORDERS_PAID` Shopify subscription. Recheck health, request text, signature
rejection and subscription configuration. Requeue the existing verified #3550
request and confirm the worker records successful email submission.

## Remaining limitation

The older requests #2294, #2784 and #2663 still require access to orders beyond
Shopify's default read window. This payment-trigger change does not grant
`read_all_orders`. The sending-only Resend key cannot inspect inbox delivery or
bounces, so successful submission must not be described as confirmed receipt.
