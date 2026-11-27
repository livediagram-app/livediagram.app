# Page layout preview

How a page layout hovered in a layout gallery is shown on its page, in every editor that offers page layouts:
livedocuments (infographic and slide pages) and livedesign (logo and wireframe pages). Each product's
`docs/specs/007-editor/pages-mode.md` "Layouts" says which layouts a page offers and what placing one does; this spec
says what the hover shows and how it stays the press's twin. liveknowledge offers no layouts (its
`002-project-scope/not-in-liveknowledge.md`).

## Hover shows exactly what a press lands

- **One placing path.** A hover and a press place the layout through the same function, the product's
  `layoutPlacedTab`: the layout built for the page, the page's own words and pictures carried in, coloured from the
  tab's theme for the page's half, put in place of everything on the page. Nothing else draws a layout on a page.
- **Drawn by the canvas.** The hover's result is drawn in place of the tab's elements, through the very path a placed
  page is drawn (each element inked for its page and the viewer's light or dark half, a wireframe page's cut to its
  screen, the tab's font and finish). So the preview cannot differ from the placed page in colour, type or design.
  It is a preview only: nothing is written, nothing enters the history, and the page comes back when the hover ends
  (leaving the tiles, closing the gallery).
- **A press lands what is shown.** A press on the layout being shown commits the very elements shown, ids and all.
  Anything else (another layout, a board that changed since the hover, no hover first) is placed afresh by the same
  path. The gallery's press never puts the preview back first.
- **A locked page** previews nothing and refuses the press.

## It draws the tile the pointer settles on

Each preview places the layout and redraws the page, so a pointer sweeping across the tiles draws nothing until it
rests on one for `LAYOUT_PREVIEW_SETTLE_MS` (70 ms: under the ~100 ms a hover reads as immediate, over the ~50 ms a
sweep spends on a tile). A tile reached by the keyboard is drawn on the next frame, with no wait, and at most one
preview is drawn a frame. Putting the page back waits a frame too, so focus moving tile to tile never flashes the page
bare. The layout builders load on the first hover or press, never with the editor.

## Share roles

Only an Editor sees a layout gallery on a page (each product's Layouts rules). A Participant or Viewer has no gallery,
so no preview; the preview is the hovering person's alone and never reaches anyone else.

## Where it lives

One copy in `packages/workbench` (`createPageLayoutPreview`), given each product's placing function, its builders and
its telemetry; the products keep only their placer, which binds their own document model. See the
[blueprint](blueprints/page-layout-preview.md).
