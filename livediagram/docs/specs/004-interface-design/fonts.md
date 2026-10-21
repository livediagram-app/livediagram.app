# Fonts

Let users set the **typeface** of text on the canvas — per element and as
a per-tab default — from a curated set of eleven Google Fonts.

## The eleven fonts

A wide spread of voices so a diagram can read as crisp, friendly, formal,
hand-drawn, or bold. Defined once in `packages/document/src/fonts.ts` (id + label

- CSS stack + Google family spec):

| id                 | Label            | Style          |
| ------------------ | ---------------- | -------------- |
| `inter`            | Inter            | Sans-serif     |
| `poppins`          | Poppins          | Geometric sans |
| `nunito`           | Nunito           | Rounded sans   |
| `oswald`           | Oswald           | Condensed sans |
| `space-grotesk`    | Space Grotesk    | Techy sans     |
| `lora`             | Lora             | Serif          |
| `abril-fatface`    | Abril Fatface    | Display serif  |
| `roboto-slab`      | Roboto Slab      | Slab serif     |
| `roboto-mono`      | Roboto Mono      | Monospace      |
| `caveat`           | Caveat           | Handwriting    |
| `permanent-marker` | Permanent Marker | Marker         |

Each CSS stack ends in a system fallback, and the stylesheet loads with
`display=swap`, so text stays visible (in the fallback face) while a font
loads — or permanently, if Google Fonts is blocked (offline / a
self-host that opts out). The editor never depends on the fonts loading.

## Two levels

- **Per element** — a Font option in the inline edit-text toolbar's `⋯`
  menu (and, for arrows, the right-click context menu's Text category).
  Sets `Element.font`. "Tab default" clears the override.
- **Per tab** — the **Font** tab of the Tab Style dialog
  ([Canvas + Theme dialog](../011-theme/canvas-and-theme-dialog.md), opened from the Style dock
  button; it was a category of the tab / canvas context menu until the
  menu was slimmed to actions), holding:
  - **Font** — sets `Tab.font`: the default for **every** text element on
    the tab that hasn't set its own. "Default" clears it.
  - **Default size for new elements** — sets `Tab.defaultTextSize` (Scale or a px, on the
    [Text Size](#text-size) control), which
    is seeded onto each element added from the palette next (a create-time
    copy onto the element's own `textSize`, not a render-time resolve — so
    changing it later never resizes existing elements). Unset = the
    per-type factory default ('md').

A **new document's first tab** (and any blank tab minted by `createTab`)
defaults `defaultTextSize` to **small** (`sm`), so a fresh canvas starts
compact. A **new tab added to an existing document** inherits the active
tab's `font` and `defaultTextSize` (the same way it inherits the theme),
falling back to small when the active tab has no explicit size — so tabs in
one document stay consistent and a brand-new tab still defaults to small
rather than the `md` factory baseline.

## Text size

A label's size (`textSize`) is **Scale** or an **exact px**. It is chosen on one control, the
**Text Size** slider (`TextSizeControl`), everywhere a label's size is set:

- an element's **Text** flyout, single and multi selection (Typography → Size);
- an arrow's **Caption** and a table's **Text** category, single and multi selection;
- a table cell's context menu;
- a chart's key, a Legend card and a Sankey's labels (no Scale: a key has nothing to fit);
- the Tab Style dialog's **Size of New Text** ([Canvas + Theme dialog](../011-theme/canvas-and-theme-dialog.md)).

The control:

- **The slider** runs **6 to 48 px in whole px** (`TEXT_PX_MIN` / `TEXT_PX_MAX`), with labelled
  breakpoints at **6, 12, 24, 36 and 48** under the track (five, since a menu flyout's track is
  narrow). 48 sits past every
  preset (a label's Large is 32px), so any older size has a place on it. It previews as it moves (where the
  surface has a preview) and commits **once, when let go**, so a drag is one undo step; letting go
  where it began commits nothing. The arrow keys step it one px at a time.
- **The readout** beside the slider says the px (`18px`), **Scale**, or **Mixed** for a
  multi-selection whose sizes differ.
- **Scale** is an icon toggle (the double-headed arrow, tooltip "Scale") to the right of the
  slider and its readout, pressed while the size is Scale. It keeps its meaning per surface: a
  note fills its box, a table cell tracks the row height, a single-line label draws at a middling
  fixed px.

An exact px **draws at that px on every surface**: a shape label, a note, an arrow caption, a table
cell, a chart key and a Sankey's labels alike, on the canvas and in every export. Earlier documents
and templates still carry the named presets **Small / Medium / Large** (`sm` / `md` / `lg`); they
render exactly as before, each on its surface's own scale (a label's Large is 32px, a note's 22px).
The slider shows a preset at the px it draws at on that surface (a label's Large reads `32px`
with the thumb at 32). Touching the slider
replaces the preset with a px; nothing converts presets on load.

Agents write the same values through the `text` alias: `sm`, `md`, `lg`, `scale`, or a whole px
from 6 to 48 (`text=18`). Anything else is refused with that list.

A **marker's** size (`markerSize`) is not a text size: it stays the four presets (Scale / Small /
Medium / Large dots), since a marker is a glyph and not a line of type
([Shape markers](../009-elements/shape-markers.md)).

Resolution order for any text: `element.font → notation font → tab.font →
editor default` (the system sans stack). `resolveFontStack` maps a stored id
to its CSS stack; an unknown / unset id falls through to the next level.

The **notation font** is the one rung the author doesn't set: an
event-storming note is written in marker (`ES_NOTE_FONT`, [Event storming](../021-event-storming/event-storming.md)), because
there the face is grammar rather than styling. It outranks the tab default
and yields to an explicit `element.font`, which is a deliberate choice.

Auto-fitting labels (`textSize: 'scale'` on a sticky) **measure in the face
they paint** — `labelMeasure(size, bold, italic, fontFamily)` — since faces
differ in width at the same px. Webfonts arrive after first paint
(`display=swap`, from a stylesheet that does not block it), so the canvas
re-renders each time a batch of faces lands (`useFontEpoch`: every
`loadingdone`, plus `document.fonts.ready` for loads settled before it
listened) and the fit re-measures in the real face instead of keeping a
size taken from the swap fallback.

Applies to every text surface: shape / text / sticky labels (committed +
live editor), table cells, and arrow labels (arrows have no per-element
font, so they take the tab default).

## Storage & behaviour

- The model stores the stable **id** (`Element.font` / `Tab.font` in
  `packages/document`), not a CSS stack, so saved documents round-trip even
  if the catalogue's exact stacks change. Both fields are optional;
  unset = inherit (element → tab → default).
- Font changes go through the normal history/commit path, so undo/redo
  and autosave cover them like any other edit. Theme changes preserve a
  tab/element's font (recolour only touches colours).
- Telemetry ([Telemetry + public transparency dashboard](../017-telemetry/telemetry.md)): `Element / Changed / Font` and `Tab / Changed /
Font`.

## Loading

A single Google Fonts stylesheet (`googleFontsHref()`) is linked in the
live app's root layout, with `preconnect` hints. One request defines
every `@font-face`; browsers only download a family once it's actually
applied to an element, so listing all eleven is cheap.

The stylesheet never holds up first paint: it is linked as
`media="print"` (fetched at low priority, not render-blocking) and an
inline script right after it (`WEBFONTS_SWAP_SCRIPT`) switches it to
`all` once it has loaded. It is cross-origin and about 60 KB, so on a
cold visit blocking on it delayed every editor route's first paint,
sign-in and the Explorer included, by a full round trip to Google.

Both pickers **preview each face**: the per-element font menu shows an
`Aa` glyph in the font beside its name, and the per-tab picker
(Tab Style's Text panel, `components/dialogs/TextTab.tsx`) shows each face as a
**specimen card**, "Aa" and its name in its own typeface, six to a carousel page
(a native `<select>` can't: browsers / macOS ignore `font-family` on `<option>`,
so the names would all look alike). Picking one letters the whole tab at once.

## Exports carry the face

An exported image is the canvas as far as its reader is concerned, so PNG /
SVG / PDF paint the same typeface the canvas did (they used to hardcode the UI
sans, which quietly rewrote every canvas — loudest on an event-storming wall,
whose marker face IS its notation).

- `describeBoxedExport` resolves the face per element (`exportFontFamily`) and
  hands it to the emitters on `ExportLabel.fontFamily`; the wrap measurement
  uses it too, or a wide face breaks at the wrong words.
- **A downloaded file carries the bytes.** `embeddedFontFaceCss`
  (`apps/live/lib/export-fonts.ts`) fetches the Latin subsets of the faces the
  tab actually used and inlines them as base64 `@font-face` rules. This is not
  belt-and-braces: the PNG path rasterises element fragments through an
  `<img>`, which blocks external resources outright, so a referenced font
  would silently come back as the fallback. Non-Latin text keeps the fallback
  face — embedding every script would multiply an export's weight for coverage
  a canvas almost never uses.
- **A headless render declares instead.** `renderElementsToSvg` (the api / mcp
  workers, which have no font-fetch budget) emits `svgFontDefs`: an `@import`
  of the Google stylesheet for the used families only. A browser opening that
  file gets the real faces; an offline vector editor gets the stack's system
  fallback.
- Both paths emit nothing at all when no element or tab picked a font, so an
  ordinary export is byte-identical to what it was before fonts existed.
- The PNG drawer awaits `document.fonts.ready` before painting: rasterising
  mid-swap would bake the fallback into the file.

Implementation: `packages/document/src/fonts.ts` (catalogue + resolver),
`components/dialogs/TextTab.tsx` (the per-tab typeface cards; element fonts use the
rich-text toolbar's own font grid in `RichTextToolbar.tsx`),
the label renderers (`element-labels.tsx`), `TableView`, and `ArrowView`
apply the resolved stack; `useElementStyle.setFontSelected` and
`useTabCanvas.setTabFont` are the mutators. See also
[Document structure](../006-document/document-structure.md) and
[Canvas and palette](../008-canvas/canvas-and-palette.md).
