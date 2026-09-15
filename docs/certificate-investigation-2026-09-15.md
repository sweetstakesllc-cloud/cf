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
- Render access was restored using the existing account. The database contains
  five customer requests, all created on 9 September. Seven-day application logs
  show the same five POST requests and no additional submissions on 14 September.
- Requests for #2294, #2784 and #2663 are `needs_review/order_not_accessible`.
  Each attempted once and successfully notified staff. Requests for #3456 and
  #3473 are `sent`. All 42 fulfillment webhook jobs are `completed`.
- Resend inbox delivery/bounce records have not been inspected. The `sent`
  status means the service's send call succeeded; it does not prove inbox receipt.

## Changes deployed

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

- All 33 certificate regression tests and TypeScript checking pass.
- A local end-to-end request with two products, one with quantity two, generated
  three real PDFs and three working verification pages. One email was captured
  by a fake mailer, and a duplicate request did not send another email.
- The migration test preserves all fields of an existing issued certificate
  and permits a second unit on the same order line.
- Local test artifacts are in `output/certificate-investigation`. Synthetic
  certificates are labelled TEST ONLY. No customer or staff email was sent.
- A production smoke check generated three real PDFs (5,106, 5,042 and 5,049
  bytes), captured one email with a fake mailer and reused the certificates on
  retry. Database changes were rolled back and temporary PDF files removed.
- After deployment, health/request endpoints returned HTTP 200, the form
  contained the updated per-item/help text, and all four existing PDFs for
  #3541/#3543 still returned HTTP 200 with `application/pdf`.

## Deployment and follow-up

Commit `f9cfe02dcfb33fa7755bb30a594d0d0adeb21db4` was fast-forwarded to
`deploy/certificates` and manually deployed on 15 September at 12:08:39 CEST.
Render reported deployment success and the service live at 12:09:24 CEST.

[Render deployment](https://dashboard.render.com/web/srv-daequev40ujc738cn7cg/deploys/dep-dakhi9rl550s73f8gnmg).

Migration `012-certificate-units.sql` ran during startup. The prior application
version uses the old unique constraint and is not compatible with the new
per-unit schema; a rollback must retain the new lookup/conflict key. Do not
remove issued unit records.

### Remaining historical-order work

The three inaccessible-order requests have not been issued or resent. They need
verified Shopify order access. Shopify reports that the existing account is not
connected to Google and requires a normal sign-in. The Shopify sign-in tab was
left open and the user was asked to log in; no password was obtained or stored.

Once signed in, verify #2294, #2784 and #2663 against their submitted checkout
emails and eligibility. Obtain `read_all_orders` through Shopify's access
process to automate older-order lookup, or use the trusted Shopify export
operator flow. Do not overwrite request emails or blindly issue old orders.
