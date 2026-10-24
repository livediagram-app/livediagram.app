# Marketing

Follow the references below only as needed; never upfront.

- ./marketing-site.md - when working on Marketing site: Landing page at `/`; claims must map to shipped features
- ./build-with-ai.md - when working on Build with AI: the `/ai` page that connects an AI tool to the MCP server, per client, and the header's Build with AI link
- ../../../../packages/comparisons/README.md - when working on Comparison / "alternative" pages: this site's `/alternatives` hub and `/alternatives/<tool>` SEO pages, built from `lib/alternatives.ts` by the shared `@liveworkspace/comparisons`
- ./marketing-assets.md - when working on Marketing assets: `marketing/` folder: off-site copy + media for listings/promotion
- ./landing-funnel.md - when working on Landing funnel: Every CTA into the editor carries a closed `via=<Surface>.<Slot>` source in its href; `/new` reads it once (then strips it from the URL) and sends `Cta·Opened` on arrival and `Cta·Created` when the document is committed. With [Page view telemetry](../017-telemetry/page-view-telemetry.md) page views that is a views → arrived → created funnel per page and per button, shown at the top of the dashboard's Pages & Help tab. The marketing site still sends only page views
- ./returning-visitor.md - when working on Returning visitor (retired): the hero shows every visitor the template fan, never their recent work; the editor no longer leaves a recent-diagrams note, and sign-out clears any an older visit left
