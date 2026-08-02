# Fonts

Let users set the **typeface** of text on the canvas — per element and as
a per-tab default — from a curated set of eleven Google Fonts.

## The eleven fonts

A wide spread of voices so a diagram can read as crisp, friendly, formal,
hand-drawn, or bold. Defined once in `apps/live/lib/fonts.ts` (id + label

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
- **Per tab** — the **Font** category of the tab / canvas context menu
  ([spec/09](09-canvas-and-palette.md)), holding:
  - **Font** — sets `Tab.font`: the default for **every** text element on
    the tab that hasn't set its own. "Default" clears it.
  - **Default size for new elements** — sets `Tab.defaultTextSize`, which
    is seeded onto each element added from the palette next (a create-time
    copy onto the element's own `textSize`, not a render-time resolve — so
    changing it later never resizes existing elements). Unset = the
    per-type factory default ('md').

A **new diagram's first tab** (and any blank tab minted by `createTab`)
defaults `defaultTextSize` to **small** (`sm`), so a fresh canvas starts
compact. A **new tab added to an existing diagram** inherits the active
tab's `font` and `defaultTextSize` (the same way it inherits the theme),
falling back to small when the active tab has no explicit size — so tabs in
one diagram stay consistent and a brand-new tab still defaults to small
rather than the `md` factory baseline.

Resolution order for any text: `element.font → tab.font → editor default`
(the system sans stack). `resolveFontStack` maps a stored id to its CSS
stack; an unknown / unset id falls through to the next level.

Applies to every text surface: shape / text / sticky labels (committed +
live editor), table cells, and arrow labels (arrows have no per-element
font, so they take the tab default).

## Storage & behaviour

- The model stores the stable **id** (`Element.font` / `Tab.font` in
  `packages/diagram`), not a CSS stack, so saved diagrams round-trip even
  if the catalogue's exact stacks change. Both fields are optional;
  unset = inherit (element → tab → default).
- Font changes go through the normal history/commit path, so undo/redo
  and autosave cover them like any other edit. Theme changes preserve a
  tab/element's font (recolour only touches colours).
- Telemetry (spec/22): `Element / Changed / Font` and `Tab / Changed /
Font`.

## Loading

A single Google Fonts stylesheet (`googleFontsHref()`) is linked in the
live app's root layout, with `preconnect` hints. One request defines
every `@font-face`; browsers only download a family once it's actually
applied to an element, so listing all eleven is cheap.

Both pickers **preview each face**: the per-element font menu shows an
`Aa` glyph in the font beside its name, and the per-tab picker
(`components/palette/FontSelect.tsx`) renders each option's **name in its own
typeface** in a compact tile grid (a native `<select>` can't — browsers /
macOS ignore `font-family` on `<option>`, so the names would all look alike).

Implementation: `apps/live/lib/fonts.ts` (catalogue + resolver),
`components/palette/FontSelect.tsx` (the per-tab font grid; element fonts use the
rich-text toolbar's own font grid in `RichTextToolbar.tsx`),
the label renderers (`element-labels.tsx`), `TableView`, and `ArrowView`
apply the resolved stack; `useElementStyle.setFontSelected` and
`useTabCanvas.setTabFont` are the mutators. See also
[spec/05](05-diagram-structure.md) and
[spec/09](09-canvas-and-palette.md).
