# Country and currency selector

Replaces the legacy searchable country disclosure in the CF menu with a native country/currency select and explicit Apply currency button. Options and the current selection come from Shopify localization, and the native Shopify localization form posts country_code. There is no product-search handler or dependency on the previous header wrapper/menu drawer. Country selection determines the currency available through Shopify Markets.

Live header backup: docs/shopify-backups/currency-2026-09-11/header-cf.liquid. Existing uncommitted menu/header redesign is preserved and excluded from this commit.
