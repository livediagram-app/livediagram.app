# Telemetry

Follow the references below only as needed; never upfront.

- ./telemetry.md - when working on Telemetry + public transparency dashboard: Anonymous first-party events sent to liveworkspace's central telemetry service + public `/telemetry` dashboard
- ./page-view-telemetry.md - when working on Page view telemetry: Every page viewed across the site, counted by page: marketing, help articles, Explorer pages, the editor and the dashboard, on full loads AND client-side navigations. Reported from the browser (the router can't see in-app navigation or read the opt-out) as a [Telemetry + public transparency dashboard](telemetry.md) `Page·View·<path>` event, the path normalised in the browser (no query, ids dropped so every project is `/project`, deny-by-default). The Pages & Help tab on the dashboard breaks them down by app (Marketing / Live / Help / Dashboard): views, share, ratios, top and rising pages
- ./timing-telemetry.md - when working on Timing telemetry: how long opening a project, switching tabs, saving and the live room take, plus every app's Core Web Vitals, sent as bucketed `Timing·Measured·<Metric>.<Bucket>` events and shown on the dashboard's Health tab (Timings section) as p50 / p75 / p95
