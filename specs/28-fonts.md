# Fonts

Let users set the **typeface** of text on the canvas — per element and as
a per-tab default — from a curated set of eight Google Fonts.

## The eight fonts

A spread of voices so a diagram can read as crisp, friendly, formal, or
hand-drawn. Defined once in `apps/live/lib/fonts.ts` (id + label + CSS
stack + Google family spec):

| id            | Label       | Style          |
| ------------- | ----------- | -------------- |
| `inter`       | Inter       | Sans-serif     |
| `roboto`      | Roboto      | Sans-serif     |
| `poppins`     | Poppins     | Geometric sans |
| `nunito`      | Nunito      | Rounded sans   |
| `lora`        | Lora        | Serif          |
| `roboto-slab` | Roboto Slab | Slab serif     |
| `roboto-mono` | Roboto Mono | Monospace      |
| `caveat`      | Caveat      | Handwriting    |

Each CSS stack ends in a system fallback, and the stylesheet loads with
`display=swap`, so text stays visible (in the fallback face) while a font
loads — or permanently, if Google Fonts is blocked (offline / a
self-host that opts out). The editor never depends on the fonts loading.

## Two levels

- **Per element** — a Font dropdown at the top of the **Text accordion**
  (Editor panel). Sets `Element.font`. "Tab default" clears the override.
- **Per tab** — a **Text** accordion in the Current Tab panel (below
  Canvas), holding:
  - **Font** — sets `Tab.font`: the default for **every** text element on
    the tab that hasn't set its own. "Default" clears it.
  - **Default size for new elements** — sets `Tab.defaultTextSize`, which
    is seeded onto each element added from the palette next (a create-time
    copy onto the element's own `textSize`, not a render-time resolve — so
    changing it later never resizes existing elements). Unset = the
    per-type factory default ('md').

A **new tab** inherits the active tab's `font` and `defaultTextSize` (the
same way it inherits the theme), so tabs in one diagram stay consistent
instead of each reverting to the editor default.

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
applied to an element, so listing all eight is cheap.

Implementation: `apps/live/lib/fonts.ts` (catalogue + resolver),
`components/FontSelect.tsx` (the shared dropdown, used by both pickers),
the label renderers (`element-labels.tsx`), `TableView`, and `ArrowView`
apply the resolved stack; `useElementStyle.setFontSelected` and
`useTabCanvas.setTabFont` are the mutators. See also
[spec/05](05-diagram-structure.md) and
[spec/09](09-canvas-and-command-palette.md).
