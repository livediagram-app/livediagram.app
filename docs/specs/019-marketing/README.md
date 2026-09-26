# Marketing

Follow the references below only as needed; never upfront.

- ./marketing-site.md - when working on Marketing site: Landing page at `/`; claims must map to shipped features
- ./comparison-pages.md - when working on Comparison / "alternative" pages: `/alternatives/<tool>` SEO pages (Miro, XMind, Excalidraw, …)
- ./marketing-assets.md - when working on Marketing assets: `marketing/` folder: off-site copy + media for listings/promotion
- ./landing-funnel.md - when working on Landing funnel: Every CTA into the editor carries a closed `via=<Surface>.<Slot>` source in its href; `/new` reads it once (then strips it from the URL) and sends `Cta·Opened` on arrival and `Cta·Created` when the diagram is committed. With [Page view telemetry](../017-telemetry/page-view-telemetry.md) page views that is a views → arrived → created funnel per page and per button, shown at the top of the dashboard's Pages tab. The marketing site still sends only page views
