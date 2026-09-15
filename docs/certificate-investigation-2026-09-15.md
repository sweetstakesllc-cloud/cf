# Certificate requests — 15 September 2026

## Production findings

- The public health and request endpoints returned HTTP 200.
- Read-only Shopify review covered the 80 most recent orders. Orders #3541 and
  #3543 each have two separate certificates for two products. All four PDF links
  returned HTTP 200 with `application/pdf`.
- Orders #3541–#3544 were created as draft orders on 14 September and have no
  order email. Their certificates exist, but the service has no verified email
  recipient. The old request handler classified a missing email as an email
  mismatch and rejected the request without staff review.
- Web orders #3545–#3548 were paid but unfulfilled at the time of inspection.
  Certificates are issued after fulfillment. Previously, requests made before
  fulfillment stayed in review even after fulfillment completed.
- The installed Shopify app has `read_orders` and `write_orders`, but lacks
  `read_all_orders`. Orders older than 60 days require manual review or the
  additional Shopify access scope. See
  [Shopify order access](https://shopify.dev/docs/api/admin-graphql/latest/queries/order).
- The exact requests reported by customers and Resend delivery results have not
  been inspected: production request storage and logs require Render access.
  Certificate creation and working PDF links do not prove email delivery.

## Changes prepared

- Missing order emails enter staff review. Matching still uses the verified
  order email; a customer-supplied address cannot bypass this check.
- Requests awaiting fulfillment or a missing email are rechecked hourly. Payment,
  cancellation, email and item eligibility are checked again before sending.
- Create a distinct certificate and PDF for every unit on every order line.
  One email contains all individual download links, in HTML and plain text.
- Existing certificate numbers and URLs remain unchanged. Repeat processing
  reuses records, and adding units uses a separate email idempotency key.
- Image downloads, PDF rendering and email requests have time limits so a
  stalled dependency cannot block the worker indefinitely.
- The public form explains per-item certificates, fulfillment, older-order
  review, spam folders and how to contact the store if no email arrives.

## Validation

- Certificate regression tests and TypeScript checking pass.
- A local end-to-end request with two products, one with quantity two, generated
  three real PDFs and three working verification pages. One email was captured
  by a fake mailer, and a duplicate request did not send another email.
- The migration test preserves all fields of an existing issued certificate
  and permits a second unit on the same order line.
- Local test artifacts are in `output/certificate-investigation`. Synthetic
  certificates are labelled TEST ONLY. No customer or staff email was sent.

## Deployment and follow-up

The fix is prepared on `fix/certificate-requests-sep15`, based on the deployment
branch. Production deployment has not been performed.

1. Inspect Render's `certificate_requests` status/reason/attempts and webhook
   failures for 14 September; correlate with Resend delivery records. Verify
   which order numbers customers reported before attributing a specific cause.
2. Deploy the code and migration `012-certificate-units.sql` together. Startup
   applies the migration. The prior application version uses the old unique
   constraint and is not compatible with the new per-unit schema; a rollback
   must retain the new lookup/conflict key. Do not remove issued unit records.
3. Verify health, request page and existing PDF links after deployment.
4. Review historical `rejected/order_email_mismatch` and
   `needs_review/line_item_review` requests individually. Reprocess only verified
   requests; do not overwrite request emails or blindly issue all old orders.
5. Correct missing contact details in Shopify and obtain `read_all_orders`
   through Shopify's access process if automatic requests for older orders are
   required. Orders outside the permitted window still need staff handling.
