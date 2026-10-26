# Presentation mode

Status: not in livedesign

livedesign is for making logos, wireframes and photos, and has no slide decks: no Slide Deck tool, no Slides button,
no speaker notes and no Present button. Slide decks are livedocuments'. **Laser**, **Spotlight** and **Zen mode** are
livedesign's tools for pointing at a design and clearing the screen while sharing it, and every page exports to PNG,
SVG and PDF.

## Saved data

A design made elsewhere, or stored by an older build, may carry a slide deck. It opens like any other design, and
the deck is never read, served, written or copied:

- The design room's SQLite keeps a `presentation` column (`apps/api/src/design-room/design-schema.ts`), since the
  schema's steps only ever add; whatever a design holds in it is left in place and ignored.
- The api ignores a `presentation` field in a create or a save, dropping it rather than refusing the save
  (`apps/api/src/routes/design-presentation-retired.test.ts`).
- A design's export (`designToEnvelopeText`) carries no deck, and importing an export that has one reads it without
  the deck (`packages/design/src/design-envelope.test.ts`). The Google Drive file's export door never serves a deck,
  and its import door makes the copy without one (`apps/api/src/routes/internal-file.test.ts`). A move from
  livediagram.app's documents writes no deck (`apps/api/src/design-room/design-migration.test.ts`).
- An Offline Mode record that holds a deck is never read for it, and converting a design either way carries none
  (`apps/live/lib/offline/offline-convert.test.ts`).
- Presenter settings in a person's preferences (a `presentation` object) are not read and are left in place.
- A slide page made in livedocuments reads as a page whose kind is not chosen yet: its elements and background stay,
  and its first page offers the choice of kind ([Pages](../007-editor/pages-mode.md) "Page kinds";
  `packages/design/src/page.test.ts`).
