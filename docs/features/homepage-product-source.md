# Homepage product source

Fresh Finds now reads the existing `all` collection, which is automatically limited to positive inventory and positive prices and sorted CREATED_DESC. The section still renders eight available products. Its New Arrivals link points to `/collections/all?sort_by=created-descending`.

The previous `new` collection uses the tag `olala`. On September 11 it contained 19 products, but only one was both published and in stock; the other inventory was draft or sold out. No drafts were published and no collection membership rules were changed.

Verified eight distinct product links on the live homepage. Backups: docs/shopify-backups/home-condition-2026-09-11. Other uncommitted homepage layout changes were preserved and excluded from this commit.
