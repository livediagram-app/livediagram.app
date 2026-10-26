# Link cards

A **link card** (`type: 'link-card'`) is a rectangular bookmark element for a URL. In liveplanner it is a model
kind: no Plan surface places one, it arrives with a tab, and nothing fetches a preview. On the canvas it draws as a
bordered, rounded card with no preview content; its URL is set, changed and removed from the element menu or a
double-click, like any element's link.

## The element

`LinkCardElement` (`type: 'link-card'`, `@liveplanner/project`, declared in
`src/element-types.ts`) is a
boxed element added through the standard new-type surface (the `annotation`
precedent): `isBoxed`, `createLinkCard` (280×120 default), the `colors.ts`
defaults + `supportsColours`, `element-variant.ts` (a bordered, rounded card:
`fillColor` background + `strokeColor` border), `search.ts`, `svg-render.ts`
(exports as a rounded rect). It is **resizable** like a shape (not a fixed
marker) and recolour / move / lock / layer / delete like any element.

- **URL source = `element.link` (`{ kind: 'url' }`)** — no new field. Editing
  reuses the existing `LinkPickerDialog` + `applyElementLink`: double-clicking
  the card opens that picker (`useBoxedElementGestures`), and the element menu's
  Link section sets, changes or removes it (`ElementContentSections`). The card also gets the normal
  link badge, so clicking it follows the URL.
- **`meta` is the cached preview** (`LinkCardMeta`: `url` + optional `title` /
  `siteName` / `image` / `favicon` / `description`). It is validated and saved
  with the tab, and nothing in liveplanner writes it.
- `THEME_COLOUR_FIELDS` gives link cards an **empty** list — a bookmark card
  keeps its neutral look across themes (like sticky / image); the user can
  still recolour per-card.

## No preview fetch

liveplanner has no unfurl route and makes no preview request: a card keeps whatever `meta` it was saved with.

## Telemetry

`track('Element', 'Added', 'LinkCard')` on create (`lib/element-telemetry.ts`).
