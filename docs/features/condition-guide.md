# Product condition guide

Published to MAIN Shopify theme 188182659400 on September 11, 2026. Clicking the condition heading opens a native modal with the merchant-provided introduction and Giftable, New, Excellent, Very Good, Good, Fair and Flawed definitions. Existing item grades, notes and the five-step scale are preserved; the guide does not classify products or infer giftability.

Integration is limited to the condition heading/fallback in the main product template's cf_specs block. Assets and snippet are namespaced cf-condition-guide. A plain-text heading remains when JavaScript is unavailable. The modal supports Escape, close button, backdrop dismissal, native focus containment and focus restoration. Sticky header keeps the close button available while scrolling the definitions.

Verified on the live Palm Angels Bear T-shirt page at desktop and 390px mobile: seven definitions, opening/closing, Escape, restored trigger focus and no horizontal dialog overflow. Screenshots: output/condition-guide. Template backup: docs/shopify-backups/condition-2026-09-11/templates__product.json. Rollback by replacing the two snippet renders with the original condition heading/fallback, preserving any later template edits.
