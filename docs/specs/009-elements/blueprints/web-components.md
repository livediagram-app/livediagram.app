# Web components and no groups: blueprint

Derived from [Web components are elements; groups are gone](../web-components-and-no-groups.md).
The spec decides; this file only adds engineering precision. Defaults applied where the spec is
silent are ledgered in [DEFAULTS.md](DEFAULTS.md) and cited as `Dn`.

Scope, by file:

| File                                                         | Role                                                                             |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `packages/document/src/web-components.ts`                    | Vocabulary, bounds, defaults, the pure layouts, `withWebRows`                    |
| `packages/document/src/component-factories.ts`               | `createComponent`, `createHero`, `COMPONENT_SIZE`, `ComponentColors`             |
| `packages/document/src/shape-factory.ts`                     | Default sizes and starting content per kind                                      |
| `packages/document/src/svg-render-web.ts`                    | `svgWebComponent`, `svgHeroCaption`: the headless render                         |
| `packages/document/src/themes.ts`                            | `themeColourFields`: accent bars retheme only their stroke                       |
| `packages/document/src/colors.ts`                            | `defaultTextColor`, `SELF_PAINTING_SHAPES`, `acceptsInlineIcon`, `RADIUS_SHAPES` |
| `packages/document/src/data-shapes.ts`                       | `isSelfDrawingShape`: stat row and process carry no label                        |
| `packages/document/src/validate.ts`                          | Row, masthead and caption bounds; the legacy `pinned-group` end                  |
| `packages/document/src/legacy-groups.ts`                     | `hasLegacyGroups`, `migrateLegacyGroups`                                         |
| `packages/document/src/stored-elements.ts`                   | `migrateStoredElements`: legacy groups, then legacy docks                        |
| `packages/document/src/stored-tab.ts`                        | `migrateStoredTab`: every stored-tab entry point runs it                         |
| `apps/api/src/tab-row.ts`                                    | `rowToTab` runs the migration                                                    |
| `apps/api/src/thumbnail.ts`                                  | The thumbnail render runs the migration on the tab it parses                     |
| `apps/live/lib/offline/offline-store.ts`                     | `offlineLoadTab` runs the migration                                              |
| `apps/live/lib/import-merge.ts`                              | `mergeImportedTab` runs the migration on a JSON tab import [QA2]                 |
| `apps/live/components/canvas/web/*.tsx`                      | One face per kind, `HeroCaptionCard`, `LabelRegion`, `WebFaceProps`              |
| `apps/live/components/canvas/InlineTextLine.tsx`             | The in-place single-line editor                                                  |
| `apps/live/components/canvas/ElementFaceRouter.tsx`          | Routes faces; computes `editable`                                                |
| `apps/live/hooks/canvas/useWebComponentSetters.ts`           | Row writes, ring append, hero caption writes                                     |
| `apps/live/hooks/canvas/useDataShapeSetters.ts`              | `setPageHeading` (`MASTHEAD_SHAPES`)                                             |
| `apps/live/components/palette/context-menu-web-editors.tsx`  | `WebRowsMenuSection`, `StatsEditor`, `TextRowsEditor`                            |
| `apps/live/components/palette/ElementContentSections.tsx`    | The image menu's "Caption Card" toggle                                           |
| `apps/live/components/canvas/CanvasElementsLayer.tsx`        | `WEB_ROW_ACTION`: the ring's add-row action                                      |
| `apps/live/lib/element-telemetry.ts`                         | `COMPONENT_TELEMETRY`, `SHAPE_TOKENS` entries                                    |
| `apps/live/lib/excalidraw-import.ts`, `excalidraw-export.ts` | No group mapping                                                                 |

## Domain and naming

| Term           | Identifier                                                                                             | Meaning                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Web component  | `WebComponentShape`, `isWebComponentShape`                                                             | `banner`, `callout`, `stat-row`, `process`, `site-header`    |
| Component      | `ComponentKind`                                                                                        | Palette id: `banner hero header callout stat process avatar` |
| Accent bar     | `isAccentBarShape`                                                                                     | `banner`, `site-header`: a solid bar under white text        |
| Card component | (the other three)                                                                                      | Theme surface fill, ink text, accent emphasis                |
| Hero           | `ImageElement` with `heroCaption`                                                                      | An image with a caption card                                 |
| Caption card   | `HeroCaption = { title, subtitle }`                                                                    | The hero's two lines                                         |
| Masthead line  | `pageTitle`, `pageSubtitle`                                                                            | Single-line heading fields shared with the Page              |
| Row            | `StatItem`, `processSteps[i]`, `navLinks[i]`                                                           | One stat, step or link                                       |
| Rows patch     | `WebRows`                                                                                              | `{ stats?, processSteps?, navLinks? }`                       |
| Layout         | `bannerLayout`, `calloutLayout`, `statRowLayout`, `processLayout`, `headerLayout`, `heroCaptionLayout` | Pure element-relative rects                                  |
| Legacy group   | `groupId`, `{ kind: 'pinned-group' }` (stored only)                                                    | Traces migrated away on read                                 |

Banned synonyms: "widget", "block" (the block-type picker), "group" for anything live, "header"
for the kind in code (the kind is `site-header`; "Header" is the user-facing name), "hero" as a
shape kind.

## Behaviour and state

### Create

`createComponent(kind, cx, cy, colors)` builds exactly one element centred on the point:

- `hero`: `createHero` (520 × 300 image, `objectFit: 'cover'`, `borderRadius: 'lg'`,
  `heroCaption: HERO_DEFAULT_CAPTION`, `fillColor: accent`, `textColor: ACCENT_BAR_TEXT`).
- `banner`, `header`: the shape with `strokeColor: accent`, `textColor: ACCENT_BAR_TEXT`.
- `callout`, `stat`, `process`: `fillColor: surface`, `strokeColor: accent`, `textColor: ink`.
- Starting content (`createShape`): banner "Banner title" / "Subtitle or description", callout
  "Heads up" / "A short note with some supporting detail.", `STAT_DEFAULTS`,
  `PROCESS_DEFAULT_STEPS`, header "Brand" + `NAV_DEFAULT_LINKS` (`D12`).

### Editing

1. **Label.** Banner title, callout body, header brand: the shared label editor, placed in the
   kind's label region (`LabelRegion`). Stat row and process have no label (`isSelfDrawingShape`).
2. **In-place lines** (`InlineTextLine`). States: **inert** (not `editable`: `pointer-events-none`,
   `tabIndex -1`), **idle** (editable), **editing** (focused; the DOM is the truth). Focus →
   editing. Blur → commit `next = collapse(text).trim().slice(maxLength)` when it differs, then
   write `next` back. Enter → blur. Escape → restore `value`, then blur. Every key is stopped from
   reaching the canvas. `editable = isSelected && !readOnly && !isLocked` (and a setter wired).
3. **Row writes.** Canvas edits one element by id (`setWebRows`); the menu edits the selection
   (`setWebRowsSelected`). Both go through `withWebRows`: each string `clampWebText` (`D4`),
   the array sliced to the kind's max, and dropped entirely when below the kind's min; a field
   lands only on its own kind.
4. **Append.** The ring's add action on a selected stat row, process or header ("Add stat", "Add
   step", "Add link") calls `appendWebRowTo(id)`, offered only while `canAppendWebRow` [QA1] (`D5`).
5. **Menu.** "Stats" / "Steps" / "Links" section in the Tools flyout: per-row inputs committing on
   blur, ↑ / ↓ reorder, × remove (disabled at the min), Add (disabled at the max) [QA4].
6. **Masthead.** `setPageHeading(id, field, value)` on `page`, `banner`, `callout`; an empty line
   stores `undefined` (`D11`).
7. **Hero caption.** Lines via `setHeroCaptionLine` (trimmed, collapsed, sliced to
   `PAGE_HEADING_MAX`); only on an image that has a caption. The "Caption Card" toggle adds
   `HERO_DEFAULT_CAPTION` or deletes `heroCaption` (`D6`).

### Layout (pure, element-relative; canvas and export call the same functions)

- **Banner:** `pad = round(clamp(min(w, h) * 0.16, 8, 32))`; subtitle band `round(subtitlePx *
1.5)` tall at the bottom of the padded box, `subtitlePx = round(clamp(h * 0.13, 11, 22))`; the
  title takes the rest.
- **Callout:** `pad = round(clamp(min * 0.15, 8, 24))`; badge radius `round(clamp(min * 0.13, 8,
22))` at the top-left; heading `round(clamp(h * 0.14, 12, 24))` px, one line; body below.
- **Stat row:** `n` cards, `gap = min(STAT_GAP, w * 0.2 / (n - 1))`, equal widths; value px
  `round(clamp(min(h * 0.34, cardW * 0.28), 12, 72))`, caption `round(clamp(value * 0.45, 10, 22))`
  [QA3].
- **Process:** columns `w / n`; caption px `round(clamp(h * 0.14, 10, 20))`; diameter
  `max(8, min(h - captionH - 6, colW * 0.62))`; connectors between neighbours, inset
  `min(8, colW * 0.06)`, drawn only when longer than 4px.
- **Header:** `pad = round(clamp(h * 0.26, 10, 28))`; logo radius `max(6, min(h * 0.29, 32))`;
  link px `round(clamp(h * 0.18, 11, 20))`; links measured by estimate (`D8`) and dropped from the
  end until the brand keeps `HEADER_BRAND_MIN`.
- **Hero card:** margin `round(clamp(min * 0.06, 6, 28))`; title px `round(clamp(h * 0.075, 12,
34))`; the card sits at the bottom, inset by the margin.

### Colours

- Accent bar: bar = `fillColor ?? accent`; text `ACCENT_BAR_TEXT` by default on any surface
  (`defaultTextColor`). Theme apply, switch and reset touch only `strokeColor`
  (`themeColourFields`).
- Cards: `fillColor` surface, `textColor` ink, accent for the card border, values, badge, circles
  and connectors.
- A collaborator's selection never changes a face's accent; it shows only on the selection ring
  [QA5].
- Hero card: `fillColor ?? '#0f172a'` at 0.82 opacity; text `textColor ?? ACCENT_BAR_TEXT`
  (`D7`). Images have no theme colour fields, so a theme switch leaves the card.

### Legacy groups (read path)

`migrateStoredTab(tab)` runs `migrateRetiredScheme`, then
`upgradeLegacyLinks(migrateStoredElements(elements))`, where
`migrateStoredElements(elements) = dropLegacyDocks(migrateLegacyGroups(elements))`. It runs in
`rowToTab`, the thumbnail render, `offlineLoadTab` and `mergeImportedTab` [QA2]. The groups step:

1. `hasLegacyGroups` false → return the same array (no copy).
2. Union box per `groupId` over non-arrow elements.
3. Each `pinned-group` end becomes `{ kind: 'free', x, y }` at `anchorFraction(anchor)` of its
   group's box; a group with no members gives `(0, 0)` (`D9`).
4. `groupId` is deleted from every element.

Invariants:

- **I1:** each component is exactly one element and carries no `groupId`.
- **I2:** after `migrateStoredElements`, no element has `groupId` and no end is `pinned-group`.
- **I3:** row counts stay within `[min, max]` per kind; every row string is at most `WEB_TEXT_MAX`.
- **I4:** canvas and export place every card, circle, link and line from the same layout call.

## Interfaces and contracts

```ts
// packages/document/src/web-components.ts
export type WebComponentShape = 'banner' | 'callout' | 'stat-row' | 'process' | 'site-header';
export type StatItem = { value: string; caption: string };
export type HeroCaption = { title: string; subtitle: string };
export type WebRows = { stats?: StatItem[]; processSteps?: string[]; navLinks?: string[] };
export function withWebRows<T extends { shape: ShapeKind }>(el: T, rows: WebRows): T;
export function appendWebRow<T extends { shape: ShapeKind } & WebRows>(el: T): T;
export function canAppendWebRow(el: { shape: ShapeKind } & WebRows): boolean;

// packages/document/src/component-factories.ts
export type ComponentColors = { accent: string; surface: string; ink: string };
export function createComponent(
  kind: ComponentKind,
  cx: number,
  cy: number,
  colors: ComponentColors,
): Element;

// packages/document/src/legacy-groups.ts / stored-elements.ts / stored-tab.ts
export function hasLegacyGroups(elements: readonly Element[]): boolean;
export function migrateLegacyGroups(elements: Element[]): Element[];
export function migrateStoredElements(elements: Element[]): Element[];
export function migrateStoredTab<
  T extends Pick<Tab, 'theme' | 'backgroundColor' | 'patternColor' | 'elements'>,
>(tab: T): T;

// apps/live/hooks/canvas/useWebComponentSetters.ts
setWebRows: (elementId: string, rows: WebRows) => void;
appendWebRowTo: (elementId: string) => void;
setWebRowsSelected: (rows: WebRows) => void;
setHeroCaptionLine: (elementId: string, field: keyof HeroCaption, value: string) => void;
setHeroCaptionSelected: (on: boolean) => void;
```

Validation (`isValidElement`; a failure rejects the tab with `invalid tab`, 400):

| Field                       | Rule                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `stats`                     | Array of at most `STATS_MAX`; each `value` and `caption` a string of at most `WEB_TEXT_MAX` |
| `processSteps`              | Array of at most `PROCESS_MAX_STEPS` strings of at most `WEB_TEXT_MAX`                      |
| `navLinks`                  | Array of at most `NAV_LINKS_MAX` strings of at most `WEB_TEXT_MAX`                          |
| `pageTitle`, `pageSubtitle` | String of at most `PAGE_HEADING_MAX`                                                        |
| `heroCaption` (image)       | Object with `title` and `subtitle`, each at most `PAGE_HEADING_MAX`                         |
| Arrow end `pinned-group`    | Accepted on write (non-empty `groupId`, known `anchor`); migrated on read                   |

The minimums (`STATS_MIN`, `PROCESS_MIN_STEPS`) are enforced by the write paths, not by validation.

## Data and persistence

| Field                               | Class     | Notes                                           |
| ----------------------------------- | --------- | ----------------------------------------------- |
| `stats`, `processSteps`, `navLinks` | persisted | Order is meaning                                |
| `pageTitle`, `pageSubtitle`         | persisted | Absent when empty                               |
| `heroCaption`                       | persisted | Presence is the toggle                          |
| `groupId`, `pinned-group` ends      | legacy    | Never written by current code; migrated on read |
| Inline edit text                    | ephemeral | In the DOM until blur                           |

Migration runs on every read and is idempotent; a tab with nothing to migrate comes back as the
same object. Nothing is written back until the next save.

## Errors and edge cases

| #   | Case                                      | Handling                                                   |
| --- | ----------------------------------------- | ---------------------------------------------------------- |
| E1  | Rows array absent (API / MCP author)      | Face draws no rows; append starts from empty               |
| E2  | Write below a kind's minimum              | `withWebRows` drops that field; the element is unchanged   |
| E3  | Header too narrow for its links           | Links dropped from the end, brand keeps `HEADER_BRAND_MIN` |
| E4  | Process too narrow                        | Circles shrink; connectors under 4px are not drawn         |
| E5  | Export text wider than its rect           | Character-estimate clip with an ellipsis (`D10`)           |
| E6  | Pasted rich text into a line              | `contentEditable="plaintext-only"`                         |
| E7  | Escape in a line                          | Restores the stored value, no commit                       |
| E8  | Legacy group with no members              | Free end at `(0, 0)` (`D9`)                                |
| E9  | Old client saves a `pinned-group` end     | Accepted; migrated on the next read                        |
| E10 | Icon dropped on banner, stat row, process | Stands alone (`acceptsInlineIcon` false)                   |
| E11 | Icon on callout or header                 | Badge glyph / logo; drawn in export too [GA2]              |
| E12 | Peer selects an accent bar                | Only the ring shows the peer's colour [QA5]                |

## Security and trust

All fields arrive through `isValidTab` at the api; strings are bounded, rendered as React text on
the canvas and escaped with `xmlEscape` in export. `migrateStoredTab` runs on the api read path
and in the thumbnail render, so MCP, share links and thumbnails never see legacy shapes.

## Performance and limits

Layouts are `O(rows)` with at most 8 rows; `migrateLegacyGroups` is one `O(n)` scan, and returns
the input unchanged in the common case.

## Presentation and UX

- Palette: the Components tab (Banner, Callout, Stat row, Process, Hero, Header), drag-to-draw or
  tap-to-drop at `COMPONENT_SIZE`.
- Radius: banner, callout, header and stat cards expose corner radius (`RADIUS_SHAPES`); banner,
  header, stat row and process expose no Border controls (`SELF_PAINTING_SHAPES`) [QA4].
- Header logo: the inline icon when set, else the brand's first letter; callout badge: the inline
  icon, else "i" [QA4].
- Disc glyphs (the callout badge, the header monogram, the process step numbers) sit on their cap
  band: `GlyphDisc` on the canvas, `capBandBaselineY` in the export.
- Quick Style Panel: the same predicates as the menu (`supportsBorderControls`,
  `acceptsInlineIcon`), and text alignment on every web component.
- Placeholders while empty: "Subtitle", "Heading", "0", "Caption", "Step", "Link", "Title",
  "Supporting line".

## Accessibility

- Every in-place line is `role="textbox"` with an `aria-label` ("Stat 1 value", "Step 2",
  "Link 3", "Banner subtitle", "Callout heading", "Hero title", "Hero supporting line").
- Menu row controls: "Move stat up", "Move stat down", "Remove stat" (and per noun).
- Inert lines are out of the tab order (`tabIndex -1`).
- White on the accent bar depends on the theme accent; built-in accents are not contrast-checked
  here. Not covered.

## Web experience

Faces are canvas-space; in-place edits touch the DOM only until blur, then one commit (INP).

## Observability

None for groups: the migration's no-op and rewrite paths emit nothing, while the scheme step of
the same pipeline logs `[tab-migrate] retired-scheme` [GA1].

## Testing

| Rule                                         | Test                                                                                  | File                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| One element per component, no `groupId` (I1) | every component builds exactly one element                                            | `packages/document/src/web-components.test.ts`                   |
| Colours per family                           | dresses the accent-bar kinds in the accent with white text                            | `packages/document/src/web-components.test.ts`                   |
| Hero is an image with a caption              | the hero is an image with a caption card in the accent                                | `packages/document/src/web-components.test.ts`                   |
| Bounds (I3)                                  | validation bounds the rows (three cases)                                              | `packages/document/src/web-components.test.ts`                   |
| Layouts re-flow (I4)                         | layouts re-flow with the box (four cases)                                             | `packages/document/src/web-components.test.ts`                   |
| Accent bar retheme touches only stroke       | an accent bar retheme touches only its stroke                                         | `packages/document/src/web-components.test.ts`                   |
| Export draws rows, title once, hero caption  | headless render (three cases)                                                         | `packages/document/src/web-components.test.ts`                   |
| `withWebRows` / `appendWebRow`               | row writes (two cases)                                                                | `packages/document/src/web-components.test.ts`                   |
| Faces commit, inert until selected           | web component faces (six cases)                                                       | `apps/live/components/canvas/web/WebComponentFace.test.tsx`      |
| Menu add, remove, reorder, bounds            | WebRowsMenuSection (five cases)                                                       | `apps/live/components/palette/context-menu-web-editors.test.tsx` |
| Setters, caption toggle                      | useWebComponentSetters (five cases)                                                   | `apps/live/hooks/canvas/useWebComponentSetters.test.ts`          |
| Migration freezes and strips (I2)            | migrateLegacyGroups (five cases)                                                      | `packages/document/src/legacy-groups.test.ts`                    |
| Migration pipeline                           | migrateStoredElements (two cases)                                                     | `packages/document/src/stored-elements.test.ts`                  |
| Tab migration includes the element step      | migrates a retired scheme and retired element fields in one pass                      | `packages/document/src/stored-tab.test.ts`                       |
| api read migrates                            | freezes a legacy group out of the stored elements                                     | `apps/api/src/tab-row.test.ts`                                   |
| Offline load runs the tab migration          | migrates a tab saved against a retired scheme on load                                 | `apps/live/lib/offline/offline-store.test.ts`                    |
| JSON import runs the tab migration           | migrates an imported tab saved against a retired scheme                               | `apps/live/lib/import-merge.test.ts`                             |
| Thumbnail runs the tab migration             | renders the migrated tab, not the colours Charcoal baked                              | `apps/api/src/thumbnail.test.ts`                                 |
| Excalidraw import has no groups              | maps common properties: opacity, angle, lock, link, dash; groups are dropped          | `apps/live/lib/excalidraw-import.test.ts`                        |
| ⌘G left to the browser                       | leaves Cmd+G to the browser now that there are no groups                              | `apps/live/hooks/canvas/useEditorKeyboardShortcuts.test.ts`      |
| Single selection bounds itself               | a single selection is bounded by the element itself                                   | `apps/live/lib/canvas-selection.test.ts`                         |
| Drag-to-draw sizes per axis                  | sizes to the dragged box, per axis                                                    | `apps/live/lib/draw-commit.test.ts`                              |
| Disc glyphs on the cap band in export        | %s centres its disc glyph on its cap band                                             | `packages/document/src/svg-cap-band-render.test.ts`              |
| Text alignment in the Quick Style Panel      | offers no text alignment on a kind with its own face, but keeps it on a web component | `apps/live/lib/quick-style.test.ts`                              |
| Ring add hidden when full                    | none [GA14]                                                                           |                                                                  |
| Export draws the inline icon                 | none [GA2]                                                                            |                                                                  |

## Constants and configuration

| Name                                      | Value                                                            | Provenance / safe range                             |
| ----------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| `WEB_TEXT_MAX`                            | 80                                                               | Row labels, not prose; 40 to 120                    |
| `STATS_MIN` / `STATS_MAX`                 | 1 / 6                                                            | A row needs one card; six fit 482px                 |
| `PROCESS_MIN_STEPS` / `PROCESS_MAX_STEPS` | 2 / 8                                                            | A process has two steps; eight stay legible         |
| `NAV_LINKS_MAX`                           | 6                                                                | A header's nav; 4 to 8                              |
| `STAT_GAP`                                | 16                                                               | Card gap, capped by width [QA3]                     |
| `HEADER_BRAND_MIN`                        | 90                                                               | Brand room before links drop; 60 to 140             |
| `ACCENT_BAR_TEXT`                         | `'#ffffff'`                                                      | The text an accent bar carries                      |
| `PAGE_HEADING_MAX`                        | 200                                                              | Masthead and caption lines (Page spec)              |
| `HERO_DEFAULT_CAPTION`                    | "Hero title" / "A short supporting line of text over the image." | Starting copy                                       |
| Hero size                                 | 520 × 300                                                        | `HERO_WIDTH`, `HERO_HEIGHT`                         |
| Hero card fallback                        | `'#0f172a'` at 0.82                                              | Tailwind slate-900                                  |
| Default sizes                             | 440×104, 380×116, 482×96, 420×110, 640×84                        | `SHAPE_DEFAULT_SIZE`, the grouped composites' sizes |

Telemetry: `Element·Added·<Banner|Callout|StatRow|ProcessSteps|Header|Hero>` on create and copy;
`Element·Changed·<StatRow|ProcessSteps|Header>` from the menu and ring, `Element·Changed·Hero` from
the caption toggle. Inline edits emit nothing [GA13].
