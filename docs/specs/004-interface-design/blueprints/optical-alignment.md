# Optical alignment blueprint

Derived from [Optical alignment](../optical-alignment.md). Icon drawings and their geometry check are
[Iconography](../iconography.md)'s; this blueprint builds everything around the glyph.

## Files

| Path                                                         | Role                                                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `packages/tailwind-config/theme.css`                         | `@utility text-optical-centre`; `@utility text-optical-caps`                                                           |
| `packages/ui/src/optical/GlyphDisc.tsx`                      | Glyph disc                                                                                                             |
| `packages/ui/src/optical/Chip.tsx`                           | Chip                                                                                                                   |
| `packages/ui/src/optical/IconSlot.tsx`                       | Icon slot                                                                                                              |
| `packages/ui/src/optical/index.ts`                           | Re-exports; `export * from './optical'` in `packages/ui/src/index.ts`                                                  |
| `packages/ui/src/optical/optical.test.tsx`                   | Primitive contracts                                                                                                    |
| `packages/diagram/src/svg-cap-band.ts`                       | `CAP_HEIGHT_EM`, `capBandBaselineY` for SVG text in a shape                                                            |
| `packages/tailwind-config/src/optical-guard.ts`              | Static guard `checkOpticalAlignment(root)`; export `./optical-guard`                                                   |
| `apps/{live,help,marketing,telemetry}/optical-guard.test.ts` | Each app runs the guard over its own sources (as `motion-budget.test.ts`)                                              |
| `packages/ui/optical-guard.test.ts`                          | The guard over `packages/ui/src`                                                                                       |
| `apps/live/e2e/optical.ts`                                   | `auditOptical(page)`: the ink audit                                                                                    |
| `apps/live/e2e/optical-audit.spec.ts`                        | The audited screens                                                                                                    |
| `apps/live/e2e/audit-screens.ts`                             | Screen setup shared with the contrast audit (seeded diagram, dark visitor)                                             |
| `scripts/e2e-stack.mjs`                                      | Also serves `apps/help/out` at `/help/*`, `apps/telemetry/out` at `/telemetry/*`, `apps/marketing/out` on its own port |

## Names

| Term (spec)      | Identifier                                  |
| ---------------- | ------------------------------------------- |
| Glyph disc       | `GlyphDisc`                                 |
| Chip             | `Chip`                                      |
| Icon slot        | `IconSlot`                                  |
| Cap band         | `capBand` (audit), `capBandBaselineY` (SVG) |
| Optical offset   | `offsetPx` on an `OpticalFailure`           |
| Tolerance        | `OPTICAL_TOLERANCE_PX = 0.5`                |
| Header icon slot | `HEADER_ICON_SLOT_PX = 20`                  |
| Opt out of audit | `data-optical-ignore` (art only, see D45)   |

## Utilities

```css
/* theme.css */
@utility text-optical-centre {
  display: inline-block;
  line-height: 1;
  text-box: trim-both cap alphabetic;
  @supports not (text-box: trim-both cap alphabetic) {
    transform: translateY(0.1em);
  }
}
/* A tracked caps label gives back the trailing letter-space after its last letter (D42). */
@utility text-optical-caps {
  text-transform: uppercase;
  letter-spacing: var(--optical-tracking, 0.05em);
  margin-inline-end: calc(-1 * var(--optical-tracking, 0.05em));
}
```

## Primitives

All three are server-safe (no hooks), forward `className` and `style`, and spread the rest onto the
root element, so callers keep their colour classes, `identityVars(...)`, ARIA and handlers.

```ts
type GlyphDiscProps = {
  size: number; // diameter, px; 12..56
  children: ReactNode; // a string/number (a text glyph) or an icon element
  as?: 'span' | 'div' | 'button'; // default 'span'
} & HTMLAttributes<HTMLElement>;

type ChipProps = {
  height: number; // px; 12..28 (D12 heights keep their probed values)
  icon?: ReactNode; // leading icon, sits in an IconSlot of `iconSize`
  iconSize?: number; // default Math.round(height * 0.5)
  caps?: boolean; // text-optical-caps
  children: ReactNode; // the label
} & HTMLAttributes<HTMLSpanElement>;

type IconSlotProps = { size: number; children: ReactNode } & HTMLAttributes<HTMLSpanElement>;
```

- `GlyphDisc` root: `inline-flex shrink-0 items-center justify-center rounded-full leading-none
select-none [&>svg]:block`, `style={{ width: size, height: size, ...style }}`. A string or number
  child renders inside `<span class="text-optical-centre">`; an element child renders as is.
- `Chip` root: `inline-flex shrink-0 items-center gap-1 rounded-full leading-none`,
  `style={{ height }}`, with padding left to the caller's class. The label renders in
  `<span class="text-optical-centre[ text-optical-caps]">`; `icon` renders in `IconSlot`.
- `IconSlot` root: `inline-flex shrink-0 items-center justify-center [&>svg]:block`,
  `style={{ width: size, height: size }}`.
- Invariants (tested): each root carries `data-optical="disc|chip|slot"`; a text child of `GlyphDisc`
  or `Chip` is always inside `.text-optical-centre`; `IconSlot` never has a computed box other than
  `size × size`.

## Header stack row

- `HEADER_ACTION_BTN` keeps its column layout. Every header action renders its glyph as
  `<IconSlot size={HEADER_ICON_SLOT_PX}>`: Share's icon, Make a copy, Sign in, the account disc
  (`<GlyphDisc size={20}>`), the Offline / Private state glyphs. With equal slots and the one
  `gap-1`, every label lands on the same baseline.

## SVG text in a shape

```ts
export const CAP_HEIGHT_EM = 0.72; // D43
export const capBandBaselineY = (centreY: number, fontPx: number) =>
  centreY + (CAP_HEIGHT_EM * fontPx) / 2;
```

- Callers drop `dominant-baseline="central"` (default alphabetic) and set
  `y={capBandBaselineY(cy, fontPx)}`. Applies to: process step numbers (`ProcessFace.tsx`,
  `svg-render-web.ts`), the progress percentage (`svg-render-data.ts` and its canvas view), sticker
  badge text (`sticker-markup.ts`), help and marketing art badges with digits or letters.
- Emoji glyphs (`icon-glyph.tsx`, `markup.ts` text prims, reaction pads) keep `central`: an emoji
  fills its em box, so the em centre is its centre (D44). User labels are out of scope.

## Ink audit

`auditOptical(page): Promise<{ measured; failures: { where; what; offsetPx }[] }>`, dark mode,
`reducedMotion: 'reduce'`, `deviceScaleFactor: 4`, pointer parked at 0,0.

1. **Discover** (in page). A candidate is an element, not inside `[data-optical-ignore]`, SVG,
   inputs, with: height 8..44px, width 8..220px; visible and in the viewport; painted (non-clear
   background colour or image, a non-clear border, or a `0 0 0 Npx` ring); content of text at most
   28 characters and/or SVG; at most 8 descendants; no `input, textarea, img, canvas` inside.
2. **Text, vertical.** For each non-blank text node: `ctx.font` from its computed style;
   `baseline = firstClientRect.top + measureText('H').fontBoundingBoxAscent`;
   `capMid = baseline - measureText('H').actualBoundingBoxAscent / 2`; offset `capMid - boxMidY`.
3. **Ink, both axes.** Screenshot the candidate; inject
   `[probe] * { visibility: hidden } [probe] { -webkit-text-fill-color: transparent }`; screenshot
   again; the ink box is every pixel whose summed RGB difference exceeds 96. Horizontal offset:
   ink centre minus box centre. Vertical offset from ink applies to candidates holding only icons.
4. **Chips leading with a disc** (first child a `data-optical="disc"` or a round painted child whose
   height is at least the chip's height minus 10px) skip the horizontal check and instead assert
   leading gap equals vertical gap within tolerance (concentric rule).
5. **SVG discs.** Every `svg circle` with a `text` sibling whose bbox lies inside it: text ink by the
   same diff (hiding the `text`), against the circle's centre.
6. **Stack rows.** A row is two or more sibling elements, each a column flexbox of height 24..72px
   whose first element child ends above its last text node, sharing a top edge within 1px. Every
   label's cap-band centre and every first child's centre match the row's first within tolerance.
7. Each failure is `offsetPx` rounded to 0.01 with `where` = up to three ancestors (tag plus
   `aria-label` / `data-testid`) and the first 24 characters of text.

**Screens** (each `expect(failures).toEqual([])` and `measured > 0`): wizard steps 1 and 2; editor
with a seeded diagram, its default panels, a shape selected, Settings, Share, the palette open, the
Explorer; the Join dialog; help home and one article; marketing home and features; telemetry
dashboard. Help / telemetry are same-origin under the e2e stack; marketing is on
`E2E_MARKETING_PORT` (default `3013`).

## Static guard

`checkOpticalAlignment(root): Violation[]` parses every `.tsx` under `root` with the TypeScript
compiler API and flags a JSX element that:

- has a class string (static chunks of a literal or template) containing `rounded-full` and
  `items-center`, and a fixed height (`h-*` / `size-*`), and
- has a direct child that is JSX text or an expression other than a JSX element,

unless the child is wrapped in `.text-optical-centre` or the element is `GlyphDisc` / `Chip`.
`formatViolations` prints `path:line  <snippet>`. It replaces `dark-palette.test.ts`'s "optical
numerals" scan (its utility assertion stays).

## Migration

Each ad-hoc shape moves onto a primitive; colour classes carry over verbatim; rendered size is
unchanged except where a stack slot grows to 20px.

| Group                          | Sites (files)                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identity discs (initials)      | `ParticipantAvatar`, `AuthControls`, `ShareDialog`, `team-pane-parts`, `CommentThreadPopover`, `collaborate-panel-parts`, `activity-pane-parts`, `TemplatePickerIdentityRow`, `AssignActionAssigneePicker`, `ActionPopover`, `SettingsAccountRows`, `element-badges`, `RollCallFace`, `ActionPanelFace`, `TabPresenceStack`                                                                                  |
| Numeral / letter discs         | `VotePane`, `PollPane`, `template-picker-wizard`, `TimerSetupBody`, `ElementVoteOverlay`, help `ArticleCard` / `ArticleLayout` / `TableOfContents` / `mdx-components`, marketing `StoryBeat`, `status/page`, telemetry `FunnelSurfaceCard`                                                                                                                                                                   |
| Icon discs                     | `TeamPane`, `ApiErrorPage`, `NotFound`, `SharePasswordGate`, `ShareOfflineGate`, `element-parts`, `PaletteFavouritesDialog`, `QaComposer`, `qa-parts`, `QaDiscussed`, `QaSpotlight`, `FocusButtonFace`, `ModeButtonFace`, round close buttons (`LineDataDialog`, `CodeEditDialog`, `SignInReasonsModal`, `SignInBanner`, `ThemeModeBanner`, `BoxEditControls`, `MetricPicker`)                               |
| Counts                         | `CountBadge`, `CollaboratePanel`, `collaborate-panel-parts`, `element-badges`, `ElementVoteOverlay`, `SettingsCategoryList`, `SlideDeckPanel`, `PickerCard`, `PaletteTileGroup`, `TabFolderChip`, `StackedCard`                                                                                                                                                                                              |
| Chips (icon and/or caps label) | `SharedBadge`, `RoleIndicator`, `diagram-badges`, `ShareLinkRow`, `ShareDialog`, `LinkPickerDialog`, `FloatingTitle`, `TabPill`, `LayerRow`, `ExplorerTabBar`, `PaletteDropdown`, `PaletteIconButton`, `PaletteToolRows`, `CollabMenuSections`, `CustomThemeBuilder`, `DecisionFace`, `QaNoteRow`, `paper-kit`, `VideoView`, `RichTextEditor`, `TimelineCard`, `TimelineGroup`, marketing `HeroIllustration` |
| Stack rows                     | `EditorHeader` + `AuthControls`, `palette-tools-nav`, `MenuTileGrid` tiles, `PollStyleTiles`, `PlacementCard`, `EmptyState`, canvas session faces (`SessionButtonFace`, `PickerFace`, `RevealFace`, `ReactionPadFace`), `StatRowFace`                                                                                                                                                                        |
| SVG text in shapes             | `ProcessFace` + `svg-render-web`, `svg-render-data` progress label, `sticker-markup` badges, help `palette-catalogues` / `primitives`, marketing `PrivacyArt`, feature-art badges                                                                                                                                                                                                                            |
| Marketing art discs (HTML)     | `feature-art/canvas`, `versatility`, `hero-illustration-glyphs`: small discs with letters use `GlyphDisc`; the art around them keeps its composition                                                                                                                                                                                                                                                         |

The ink audit is the arbiter: a site not listed that fails it joins the migration; a listed site
that already passes still moves onto the primitive so the guard holds it.

## Errors and edge cases

| Case                                                 | Handling                                                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Browser without `text-box`                           | `translateY(0.1em)` fallback (D13); all target engines support it (Chrome 133, Safari 18.2, Firefox 154) |
| Padding-sized pill loses height when trimmed         | `Chip` takes an explicit `height`; D12 probed heights stay                                               |
| Two-letter initials wider than the disc              | `GlyphDisc` text is `whitespace-nowrap`; callers size the font (ratio 0.4 for two letters)               |
| Truncated label in a chip                            | The label span takes `min-w-0 truncate` from the caller; trimming is vertical only                       |
| Hidden / zero-size shape                             | Not a candidate                                                                                          |
| Ink diff finds no pixels (glyph same colour as fill) | Candidate reports text checks only; logged in the report's `measured` count                              |
| Hover, focus or animation changes paint              | Pointer parked, reduced motion, `animations: 'disabled'` screenshots                                     |
| Art shape that is composition, not a glyph frame     | `data-optical-ignore` on the art root (D45)                                                              |

## Observability

- The audit annotates each screen with `measured` and prints each failure as
  `<offsetPx>px <what> at <where>`; the static guard prints `path:line`. No runtime logging: the
  rules are layout, with no runtime decision points.

## Performance

- `text-box` and the primitives add no JS and no layout passes. The audit costs two element
  screenshots per candidate (~100 candidates per screen, ~40ms each at 4x): under 10s a screen.

## Web Experience

- CLS: every primitive has an explicit width and height (`size` / `height`), so trimming the text box
  never resizes its host; a Chip that took its height from padding is pinned at its previous rendered
  height (D12). No fonts are loaded for this, and `text-box` is resolved at style time, so LCP and INP
  are untouched.

## Accessibility

- The primitives are presentational; ARIA passes through. Trimming changes no text size, colour or
  focus ring. A `GlyphDisc as="button"` needs an `aria-label` (typed via the caller; the guard's
  existing a11y lint covers icon-only buttons).

## Testing

| Spec rule                              | Test                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| Tolerance, text cap band, ink centring | `optical-audit.spec.ts` (every screen)                                                |
| Tracked caps give back trailing space  | `optical.test.tsx` "caps chip"; audit horizontal check on chips                       |
| Chip centred as a whole / concentric   | Audit steps 3 and 4                                                                   |
| Stack row shares one line              | Audit step 6; `optical.test.tsx` "IconSlot is size × size"; header test               |
| SVG text on its cap band               | `svg-cap-band.test.ts`; `svg-render-*.test.ts` assert alphabetic + `capBandBaselineY` |
| Primitives are the one implementation  | `optical-guard.test.ts` per workspace                                                 |
