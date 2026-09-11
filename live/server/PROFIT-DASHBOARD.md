# Circular Fash profit dashboard

Private embedded Shopify app page: `/profit`. Uses App Bridge ID tokens checked against the existing Shopify app client ID/secret, exact shop destination, issuer, signature and expiry. Anonymous financial API reads and writes return 401. Only the HTML/JS shell is public; no financial data or credentials are embedded in it. Access is granted to Shopify staff who can access this installed app.

## App configuration

In Shopify Dev Dashboard, open the installed **Admin API Scopes** app (handle `admin-api-scopes-48`). Create and release a version with app URL `https://certificates.circularfash.com/profit`. Keep embedding enabled and preserve existing scopes and webhook configuration. The existing `read_orders` and `read_products` permissions supply order fees and item costs; `write_products` supports explicit cost updates. No new payment provider permissions are required for the transaction-fee data currently used.

Do not expose a preview token in production. The optional local preview credential is configured only by the temporary local preview entry point, bound to loopback; the production entry point never sets it.

## Data and calculations

Migration 011 adds a private order cache, immutable first-import cost snapshots, current variant costs, order adjustments, expenses and an audit log. Sync runs on startup, every ten minutes, and on a merchant request; a PostgreSQL advisory lock prevents concurrent syncs across instances. All money uses integer SEK ore; grouping uses Europe/Stockholm.

Included orders are paid, partially refunded or refunded, with test orders excluded. Net sales = received payments minus refunds minus Shopify's current recorded VAT (or an explicit tax override). COGS uses the saved purchase cost times remaining units plus refunded units that were not restocked. Fees are summed once per fee ID on successful transactions only, with fee tax included and flagged for recoverability review. Failed attempts are excluded. Missing fees and foreign fee currencies require confirmation, never silent zero estimates. Shipping charged to customers remains part of sales; shipping and packaging expenses are separate.

Reports attribute refunds to the original order date, not the refund date. Expenses are attributed to their entered date. This is an order-based management report, not payout reconciliation or statutory accounts. Third-party fees, chargebacks and Shopify billing charges may need manual expense entries; no unsupported automatic fee rate is invented.

The app currently has only the default recent-order read window. Initial sync reads the last 59 days, leaving a one-day boundary margin, and retains imported orders thereafter. Older retained orders cannot be refreshed outside the access window; `read_all_orders` requires Shopify approval to import and refresh complete history. The UI identifies the imported coverage and incomplete date selections.

Historical costs copied from Shopify on first import are marked provisional; later product updates do not overwrite them. Staff can confirm/correct a historical order cost explicitly. The missing-product-cost form writes Shopify's purchase cost, with an explicit checkbox to fill only still-missing historical snapshots. Existing non-null snapshots remain unchanged. Cost and expense edits are audited by Shopify staff ID.

VAT treatment is not confirmed by the merchant. The dashboard uses recorded Shopify VAT and displays an unconfirmed-basis alert. VMB is not automatically calculated. Staff can enter an order-specific tax adjustment after confirming their accounting treatment. Shipping/packaging defaults are explicitly estimated and never override order-specific expenses.

## Validation

14 profit arithmetic/authentication/database/API tests; 21 existing certificate/request/image tests; TypeScript checking; real read-only Shopify import; authenticated local browser checks on desktop/mobile, cost search and order dialogs. No live purchase costs or financial records were modified during verification. Real store screenshots and preview credentials are kept outside Git.

Local preview: the temporary `/private/tmp/cf-profit-preview.mts` serves loopback port 3034 against isolated PostgreSQL port 55439. Its URL is in the mode-600 `/private/tmp/cf-profit-preview-access.json`. Test database `profit_test` is separate from the preview's imported records.

## VAT visibility update — September 11, 2026

Overview shows receipts including VAT, profit before recorded sales VAT, recorded VAT, and profit after VAT. Both results deduct the same recorded item costs, fees, shipping, packaging and business expenses. Tax is taken from Shopify or an explicit order override, not a fixed percentage. Orders and CSV show both results; daily/monthly charts have a before/after VAT selector, defaulting to before VAT. Missing costs/fees keep both order profit amounts unknown, with known-cost subtotals still labeled as incomplete. This changes presentation and adds report fields; it does not change VAT treatment or tax records.

Verified with 16 profit tests (including VAT overrides, missing costs, refunds and expense-only dates), TypeScript, and desktop/mobile browser checks of KPI arithmetic, both chart modes, monthly grouping and order detail. Fresh isolated test DB uses port 55549; older isolated port 55439 remains supported.

Foreign-currency orders are excluded from SEK aggregates and listed explicitly in the Orders tab and CSV. The overview warns that the report is partial. No FX conversion is guessed. This also prevents imported marketplace orders with non-SEK shopMoney from crashing the entire report.
