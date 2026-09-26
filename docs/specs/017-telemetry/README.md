# Telemetry

Follow the references below only as needed; never upfront.

- ./telemetry.md - when working on Telemetry + public transparency dashboard: Anonymous first-party events in D1 + public `/telemetry` dashboard
- ./page-view-telemetry.md - when working on Page view telemetry: Every page viewed across the site, counted by page: marketing, help articles, Explorer pages, the editor and the dashboard, on full loads AND client-side navigations. Reported from the browser (the router can't see in-app navigation or read the opt-out) as a [Telemetry + public transparency dashboard](telemetry.md) `Page·View·<path>` event, the path normalised in the browser (no query, ids dropped so every diagram is `/diagram`, deny-by-default). A Pages tab on the dashboard breaks them down by app (Marketing / Live / Help / Dashboard): views, share, ratios, top and rising pages
