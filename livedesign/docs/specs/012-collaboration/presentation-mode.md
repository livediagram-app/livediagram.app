# Presentation mode (removed)

Status: removed 25 October 2026. livedesign has no slide decks.

livedesign is for making logos, wireframes and photos. It used to carry the slide deck it was forked with: a
**Slide Deck** canvas tool and panel, a **Slides** button over every Pages tab (each page a slide), a deck button
and speaker notes on each page's title bar, a **Present** button in the header, and a full-screen presentation with
its own controls, presenter notes, pacing, transitions and settings. Slide decks belong to livedocuments, which
keeps them; livedesign does not need them, so they are gone.

## What went with it

- The Slide Deck tool (`slide-deck` in `CanvasTool`), its panel and its row menus, and the page picker that added
  a page to the deck again.
- The **Slides** button and popover in a Pages tab's bottom-right cluster. **Contents** stays
  ([Pages](../007-editor/pages-mode.md) "Chrome in Pages mode").
- Each page title bar's deck button (hide from the deck) and its **Add Notes** button.
- The header's **Present** button.
- Presenting itself: the full-screen overlay, its controls (position, jump list, notes, elapsed time and slide
  budget, settings, close), the read-only element popover, the end state, the screen wake lock, the slide View
  Transitions, and the editor states that only existed while a deck ran (shortcuts, remote cursors and snapping
  switched off, the zen treatment, the letterboxed page).
- The presenter settings: **Settings > Presenting** and the controls' settings cog.
- The deck model and its helpers in `@livedesign/design` (`Slide`, `Deck`, `StoredPresentation`, the follow-the-pages
  pass) and the deck's slide thumbnails.
- The Slides steps of the [Pages tour](../007-editor/pages-tour.md), and the wireframe track's Present It step.
- The code only the deck used: the identity-stable object it was handed to the canvas through, the focus return on
  leaving a presentation, the chat-style comment bubbles of its element popover, its play glyph, the step out of the
  tool on a phone, and the canvas's View Transition (no surface animates as one now,
  [Motion](../004-interface-design/motion.md) "View Transitions").
- Its help articles (the Slide Deck section and its pages) and its marketing copy.
- Its events, retired on the telemetry dashboard
  ([Telemetry, "Retired features"](../017-telemetry/telemetry.md#retired-features)).

What stays: **Laser**, **Spotlight** and **Zen mode** are their own tools and modes, for pointing at a design and
clearing the screen while you share it, and every page still exports to PNG, SVG and PDF.

## Saved data

Nothing anyone made is lost, and every design opens as before.

- A design's stored deck (the `presentation` column of the design room's SQLite,
  `apps/api/src/design-room/design-schema.ts`) is no longer read, served, written or copied. The column stays
  where it is, because the schema's steps only ever add, and whatever a design holds in it is left in place.
- The api ignores a `presentation` field in a create or a save, so an editor still open on an older build saves its
  design as before; its deck is dropped rather than refused (`apps/api/src/routes/design-presentation-retired.test.ts`).
- A design's export (`designToEnvelopeText`) no longer carries a deck, and importing an older export that has one
  reads it without the deck (`packages/design/src/design-envelope.test.ts`). The same holds for the design's Google
  Drive file: the export door never serves the kept deck, and the import door makes the copy without one
  (`apps/api/src/routes/internal-file.test.ts`). The one-time move from livediagram.app's old documents writes no
  deck into a livedesign design either (`apps/api/src/design-room/design-migration.test.ts`).
- An Offline Mode record written before the removal may still hold its deck; nothing reads it, and taking a design
  offline or saving one to the cloud no longer carries one (`apps/live/lib/offline/offline-convert.test.ts`).
- The presenter settings stored in a person's preferences (one `presentation` object) are no longer read and are
  left in place.
- A slide page made in livedocuments reads, as before, as a page whose kind is not chosen yet: its elements and
  background stay, and its first page offers the choice of kind ([Pages](../007-editor/pages-mode.md) "Page
  kinds"). `packages/design/src/page.test.ts` pins it.
