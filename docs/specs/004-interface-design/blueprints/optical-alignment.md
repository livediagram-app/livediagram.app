# Optical alignment blueprint

Derived from [Optical alignment](../optical-alignment.md). Icon drawings, their ink insets and their
geometry check are [Iconography](../iconography.md)'s; this blueprint builds everything around the glyph.

## Files

| Path                                                         | Role                                                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `packages/tailwind-config/theme.css`                         | `@utility text-optical-centre`, `text-optical-line`, `text-optical-caps`, `optical-edges`                   |
| `packages/tailwind-config/src/optical-utilities.test.ts`     | The utilities' contracts                                                                                    |
| `packages/ui/src/optical/GlyphDisc.tsx`                      | Glyph disc                                                                                                  |
| `packages/ui/src/optical/Chip.tsx`                           | Chip                                                                                                        |
| `packages/ui/src/optical/IconSlot.tsx`                       | Icon slot                                                                                                   |
| `packages/ui/src/optical/index.ts`                           | Re-exports; `export * from './optical'` in `packages/ui/src/index.ts`                                       |
| `packages/ui/src/optical/optical.test.tsx`                   | Primitive contracts                                                                                         |
| `packages/ui/src/Button.tsx`                                 | `ButtonContent`; `optical-edges` in the button base                                                         |
| `apps/live/components/chrome/header-action.tsx`              | `HEADER_ACTION_BTN`, `HEADER_ICON_SLOT_PX`, `HeaderGlyph`                                                   |
| `packages/icons/src/svg-cap-band.ts`                         | `CAP_HEIGHT_EM`, `capBandBaselineY` (`icons` is the lowest package both SVG renderers use)                  |
| `packages/tailwind-config/src/optical-guard.ts`              | Static guard `checkOpticalAlignment(root)`; export `./optical-guard`                                        |
| `apps/{live,help,marketing,telemetry}/optical-guard.test.ts` | Each app runs the guard over its own sources (as `motion-budget.test.ts`)                                   |
| `packages/ui/optical-guard.test.ts`                          | The guard over `packages/ui/src`                                                                            |
| `apps/live/e2e/optical.ts`                                   | `auditOptical(page)`: the runner (screenshots, ink diff, verdicts)                                          |
| `apps/live/e2e/optical-discover.ts`                          | `discover`: the in-page half (candidates, cap bands, intent, stack rows); one self-contained function       |
| `apps/live/e2e/optical-audit.spec.ts`                        | The editor's audited screens                                                                                |
| `apps/live/e2e/optical-audit-sites.spec.ts`                  | The help centre, telemetry dashboard and marketing site                                                     |
| `apps/live/e2e/audit-screens.ts`                             | Screen setup shared with the contrast audit (seeded diagram, dark visitor, share link)                      |
| `scripts/e2e-stack.mjs`                                      | Also serves `apps/help/out` at `/help/*`, `apps/telemetry/out` at `/telemetry/*`, marketing on its own port |
| `.github/workflows/e2e.yml`                                  | Builds help, telemetry and marketing beside live                                                            |

## Names

| Term (spec)      | Identifier                                      |
| ---------------- | ----------------------------------------------- |
| Glyph disc       | `GlyphDisc`                                     |
| Chip             | `Chip`                                          |
| Icon slot        | `IconSlot`                                      |
| Button label     | `ButtonContent`                                 |
| Cap band         | `capBand` (audit), `capBandBaselineY` (SVG)     |
| Ink inset        | `--glyph-ink-l / -r / -t / -b` (set by `Glyph`) |
| Optical offset   | `offsetPx` on an `OpticalFailure`               |
| Tolerance        | `OPTICAL_TOLERANCE_PX = 0.5`                    |
| Header icon slot | `HEADER_ICON_SLOT_PX = 20`                      |
| Opt out of audit | `data-optical-ignore` (art only, see D45)       |

## Utilities

```css
/* theme.css */
/* A glyph in a fixed-size host: trimmed to its cap band; the host pins its own size. */
@utility text-optical-centre {
  display: inline-block;
  line-height: 1;
  text-box: trim-both cap alphabetic;
  @supports not (text-box: trim-both cap alphabetic) {
    transform: translateY(0.1em);
  }
}
/* A label in a host that keeps its height: trimmed, then given back half the line's leftover height above
 * and below, so the box is still one line tall. Needs a flex (or grid) parent: in a block line an
 * inline-block sits on the baseline, and the trim moves nothing. Padding, not margin: overflow clips
 * at the padding edge, so a truncated label keeps its descenders and accents. */
@utility text-optical-line {
  display: inline-block;
  text-box: trim-both cap alphabetic;
  padding-block: calc((1lh - 1cap) / 2);
  @supports not (text-box: trim-both cap alphabetic) {
    padding-block: 0;
  }
}
/* An icon at a control's first or last edge pulls in by its own blank margin. Direct children only: a
 * negative margin inside a centring slot is split by the centring and halves. */
@utility optical-edges {
  & > svg:first-child {
    margin-inline-start: calc(-1 * var(--glyph-ink-l, 0px));
  }
  & > svg:last-child {
    margin-inline-end: calc(-1 * var(--glyph-ink-r, 0px));
  }
}
/* Tracked capitals give back the letter-space after their last letter (D42). */
@utility text-optical-caps {
  text-transform: uppercase;
  letter-spacing: var(--optical-tracking, 0.05em);
  margin-inline-end: calc(-1 * var(--optical-tracking, 0.05em));
}
```

A caps label whose tracking is not `0.05em` sets `[--optical-tracking:<em>]` on the label (`0em` for an
untracked key cap) and drops its own `tracking-*` / `uppercase` classes.

## Primitives

All are server-safe (no hooks), forward `className` and `style`, and spread the rest onto the root, so
callers keep their colour classes, `identityVars(...)`, ARIA and handlers.

```ts
type GlyphDiscProps = {
  size?: number; // diameter, px; omitted only when breakpoint classes (h-* / w-*) size it
  children: ReactNode; // text (a string, a number, or both side by side) or an icon element
  as?: 'span' | 'div' | 'button'; // default 'span'
} & HTMLAttributes<HTMLElement> &
  Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'disabled'>;

type ChipProps = {
  height?: number; // px; pinned only where a fixed size is the design, else padding sizes it
  icon?: ReactNode; // leading icon, sized by the caller, rendered as the chip's first child
  caps?: boolean; // text-optical-caps
  radius?: 'full' | 'sm'; // pill (default) or a 4px-corner badge
  children: ReactNode; // the label
} & HTMLAttributes<HTMLSpanElement>;

type IconSlotProps = { size: number; children: ReactNode } & HTMLAttributes<HTMLSpanElement>;
```

- `GlyphDisc` root: `inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap
rounded-full leading-none [&>svg]:block`, `width` / `height` from `size` when given. Text children
  render inside `<span class="text-optical-centre">`; an element child renders as is.
- `Chip` root: `optical-edges inline-flex shrink-0 items-center gap-1 [&>svg]:block`, `rounded-full` or
  `rounded`, `height` when given. `icon` renders as is, first; the label renders in
  `<span class="text-optical-line[ text-optical-caps]">`.
- `IconSlot` root: `inline-flex shrink-0 items-center justify-center [&>svg]:block`, `size × size`.
- Invariants (tested): each root carries `data-optical="disc|chip|slot"`; text in `GlyphDisc` is inside
  `.text-optical-centre`, text in `Chip` inside `.text-optical-line`; `IconSlot` is `size × size`.

## Button labels and icon edges

- `Button` renders its children through `ButtonContent`: each string or number child becomes
  `<span class="text-optical-line">`; elements pass through. Anchors styled with `buttonClassName` wrap
  their children in `ButtonContent` (help header and contact, `SiteHeader`, marketing `CtaLink` / `Hero`,
  the editor's toasts, sign-in prompts, team invites).
- `optical-edges` sits on `buttonClassName`'s base, `Chip`, the section switch (`ProductNav`), the
  timeline's view and filter buttons, and the help `CountPill`.
- Invariant: a host with `optical-edges` holds its text in elements, never bare text nodes. CSS
  `:first-child` ignores text, so `Next<svg/>` would make the arrow both first and last child.
  `ButtonContent` and `Chip` guarantee it; other hosts wrap their label in `text-optical-line`.
- Contract with the icon catalogue ([Iconography](../iconography.md)): `Glyph` unions its drawn children's
  geometry, stroke included, at its `size` prop, and sets `--glyph-ink-l`, `-r`, `-t`, `-b` (px, two
  decimals, at least 0) on its `<svg>` style. Pure and synchronous, so static exports carry the values
  and nothing shifts after paint. A child it cannot read (a transform, an opaque component) means no
  variables, and the fallback of 0 applies. The insets follow `size`, not a CSS resize.
- An icon that must be coloured passes its colour class to the icon itself: a wrapper would hide the
  svg from the edge rule.

## Header stack row

- `HEADER_ACTION_BTN` keeps its column layout. Every header action renders its glyph in
  `<HeaderGlyph>` (an `IconSlot` of `HEADER_ICON_SLOT_PX`): Copy, Share, Sign in, and the account
  initial as `<GlyphDisc size={HEADER_ICON_SLOT_PX}>`. With equal slots and the one `gap-1`, every
  label lands on the same baseline.

## Controls that keep their height

- The section switch (`ProductNav`) pins `h-[34px]`; its label is `text-optical-centre max-sm:hidden`.
- The tab pill's button pins `h-7`; the name sits in `text-optical-centre`; the active tab with its
  ellipsis menu pads `pl-2.5 pr-1`, so the ellipsis button's own padding balances the dot's side.
- The share-state chip (`SharedBadge`) and the timeline's day badges pin `height={19}`, their probed
  heights.
- Everything else keeps its padding-given height through `text-optical-line`.

## SVG text in a shape

```ts
export const CAP_HEIGHT_EM = 0.72; // D43
export const capBandBaselineY = (centreY: number, fontPx: number) =>
  centreY + (CAP_HEIGHT_EM * fontPx) / 2;
```

- Callers drop `dominant-baseline="central"` (alphabetic is the default) and set
  `y={capBandBaselineY(cy, fontPx)}`: process step numbers (`ProcessFace.tsx`, and
  `svg-render-web.ts` through `line(..., { onCapBand: true })`), the callout badge's "i" and the site
  header's monogram (export; the canvas draws them as `GlyphDisc`), the progress percentage
  (`svg-render-data.ts`, `PROGRESS_LABEL_PX = 14`; its canvas label is `text-optical-centre`), and badge
  stickers (`sticker-markup.ts`: the word on the pill's centre line, `x` moved half the tracking right,
  because SVG centres a word with its trailing letter-space).
- Emoji glyphs (`icon-glyph.tsx`, `markup.ts` text prims, reaction pads, emoji stickers) keep `central`:
  an emoji fills its em box, so the em centre is its centre (D44). User labels are out of scope.

## Ink audit

`auditOptical(page): Promise<{ measured; failures: { where; what; offsetPx }[] }>`, dark mode,
`reducedMotion: 'reduce'`, `deviceScaleFactor: 4`, after `networkidle` (tagging a hydrating tree reads
as a hydration mismatch), pointer parked at 0,0.

1. **Discover** (in page, `optical-discover.ts`). A candidate is an element, not inside
   `[data-optical-ignore]` or an SVG, not an input, with: height 8..44px, width 8..220px; visible and in
   the viewport; painted (a non-clear background colour or image, a non-clear border, or a
   `0 0 0 Npx` ring); text of at most 28 characters and/or SVG; at most 8 descendants; no
   `input, textarea, img, canvas, video` inside. Its **own text** is the text not inside a painted
   shape nested within it.
2. **Intent.** Horizontal centring is asked of a shape with centring `justify-content`, `text-align:
center`, or shrink-wrapped content (its in-flow children, text and gaps fill the inner width, and
   none grows). Vertical centring is asked of a row flexbox with `align-items: center`, a column
   flexbox with centring `justify-content`, a centring grid, or content that fills the inner height;
   never of a column holding two or more items (a stack, held by step 6). Each horizontal failure
   names its intent.
3. **Text, vertical.** For each own text node: `ctx.font` from its computed style;
   `baseline = firstClientRect.top + measureText('H').fontBoundingBoxAscent`;
   `capMid = baseline - measureText('H').actualBoundingBoxAscent / 2`; offset `capMid - boxMidY`.
   Text rendered in capitals (by content, or `text-transform: uppercase`) is judged by its own ink
   instead (a third screenshot, hiding only the glyph fill).
4. **Ink.** Clip on the device-pixel grid, one pixel out, keeping the shape's exact box inside it.
   Screenshot; inject `[probe] * { visibility: hidden } [probe] { -webkit-text-fill-color: transparent }`;
   screenshot again; the ink box is every pixel whose summed RGB difference exceeds 96 (D46). A shape
   another element paints over (sampled at five points) is occluded: no ink checks.
5. **Horizontal.** Each edge is judged by what sits at it: text by its advance (less a trailing
   letter-space), anything else by ink; initials and symbols (1 to 3 non-space characters, not all
   digits) and icons by ink on both edges; numerals by their advance. A shape holding two or more
   controls (a segmented switch) is judged by its controls' boxes. Icon-only shapes are also judged
   vertically by ink.
6. **Chips leading with a disc** (first child painted, round, at least the chip's height minus 10px)
   skip the horizontal check and assert leading gap equals vertical gap (concentric rule).
7. **SVG discs.** Every `svg circle` with a `text` sibling inside it: text ink (hiding the `text`)
   against the circle's centre.
8. **Stack rows.** Two or more siblings, each a column flexbox 24..72px tall whose first element child
   ends above its last text node, sharing a top edge within 1px: every label's cap-band centre and every
   first child's centre match the row's first within tolerance.
9. Each failure is `offsetPx` to 0.01 with `where` = up to three ancestors (tag plus `aria-label` /
   `data-testid`) and the first 24 characters of text.

**Screens** (each `expect.soft(failures).toEqual([])` and `measured > 0`): wizard steps 1 and 2; the
editor with a seeded diagram and its default panels, a shape selected, Settings, Share; the Join dialog;
the Explorer; help home, a category and an article; the telemetry dashboard; marketing home and a
feature page. Help and telemetry are same-origin under the e2e stack; marketing is on
`E2E_MARKETING_PORT` (default `3013`). Against dev servers: `E2E_HELP_URL`, `E2E_TELEMETRY_URL`,
`E2E_MARKETING_URL`. A site that is not built fails with the build command to run.

## Static guard

`checkOpticalAlignment({ root }): OpticalViolation[]` parses every `.tsx` under `root` (not tests, not
`e2e/`, not the primitives' own `optical/` folder) with the TypeScript compiler API and flags a JSX
element that:

- has a class string (static chunks of a literal or template) with `rounded-full` and a centring token,
  and a fixed size (an `h-*` / `size-*` class, or `width` / `height` in its `style`), and
- holds text that can reach it untrimmed: JSX text, or an expression that may be text (anything but
  JSX, `null`, `false`, or an identifier or property named like an icon), directly or through plain
  wrappers (`span`, `div`, `b`, `strong`, `em`, `small`) without `text-optical-centre`,

unless the element is `GlyphDisc`, `Chip` or `IconSlot`. `formatViolations` prints
`path:line  <snippet>  (wrap in text-optical-centre, or use GlyphDisc / Chip)`.

## Migration

Every site below moved onto a primitive or a utility; colour classes carried over verbatim; rendered
size is unchanged except where a header slot grew to 20px.

| Group                     | Sites (files)                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity discs (initials) | `ParticipantAvatar`, `AuthControls`, `ShareDialog`, `team-pane-parts`, `CommentThreadPopover`, `collaborate-panel-parts`, `activity-pane-parts`, `TemplatePickerIdentityRow`, `AssignActionAssigneePicker`, `ActionPopover`, `SettingsAccountRows`, `element-badges`, `RollCallFace`, `ActionPanelFace`, `TabPresenceStack`, `qa-parts`                                                                                                              |
| Numeral / letter discs    | `VotePane`, `TimerSetupBody`, `ElementVoteOverlay`, `BoxEditControls`, canvas `CalloutFace` / `SiteHeaderFace`, help `ArticleCard` / `ArticleLayout` / `TableOfContents`, marketing `StoryBeat`, `feature-art/canvas`, `hero-illustration-glyphs`                                                                                                                                                                                                    |
| Icons as glyphs           | telemetry `MetricPicker` (the text "✕" is the shared `CloseIcon`)                                                                                                                                                                                                                                                                                                                                                                                    |
| Chips                     | `SharedBadge`, `RoleIndicator`, `diagram-badges`, `ShareLinkRow`, `ShareDialog`, `LinkPickerDialog`, `FloatingTitle`, `TabPill`, `LayerRow`, `ExplorerTabBar`, `PaletteDropdown`, `PaletteIconButton`, `PaletteToolRows`, `CollabMenuSections`, `CustomThemeBuilder`, `DecisionFace`, `QaNoteRow`, `paper-kit`, `VideoView`, `RichTextEditor`, `TimelineCard`, `TimelineGroup`, help `CountPill`, marketing `HeroIllustration` and feature-art chips |
| Controls                  | `Button` and every `buttonClassName` link, `ProductNav`, `TimelineControls`, `SettingsCategoryList`                                                                                                                                                                                                                                                                                                                                                  |
| Stack rows                | `EditorHeader` + `AuthControls`                                                                                                                                                                                                                                                                                                                                                                                                                      |
| SVG text in shapes        | `ProcessFace` + `svg-render-web` (steps, callout, monogram), `svg-render-data` + `ProgressView`, `sticker-markup`                                                                                                                                                                                                                                                                                                                                    |

The ink audit is the arbiter: a site that fails it joins the migration.

## Errors and edge cases

| Case                                               | Handling                                                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Browser without `text-box`                         | `translateY(0.1em)` / no padding fallbacks; every target engine has it (Chrome 133, Safari 18.2, Firefox 154) |
| A trimmed label in a padding-sized host            | `text-optical-line` keeps the line box; `text-optical-centre` only in hosts that pin their size               |
| A trimmed label in a block line                    | No effect: `text-optical-line` needs a flex or grid parent, so such hosts become `inline-flex`                |
| Two-letter initials wider than the disc            | `GlyphDisc` text is `whitespace-nowrap`; callers size the font (0.4 of the size for two letters)              |
| A responsive disc                                  | `GlyphDisc` without `size`, sized by its breakpoint classes                                                   |
| Truncated label                                    | The label span takes `truncate`; the line is given back as padding, so the clip edge clears descenders        |
| An edge icon without ink insets                    | Compensated by 0: the fallback in `optical-edges`                                                             |
| An edge icon in a centring wrapper                 | Not compensated (a centring box halves a negative margin): render the icon as the host's own child            |
| Hidden / zero-size / occluded shape                | Not a candidate / no ink checks                                                                               |
| Hover, focus, animation or hydration changes paint | Pointer parked, reduced motion, `animations: 'disabled'`, `networkidle` before tagging                        |
| Art that is composition, not a glyph frame         | `data-optical-ignore` on the art root (D45); its glyph discs and chips still follow the rules                 |

## Observability

- The audit annotates each screen with `measured` and prints each failure as
  `<offsetPx>px <what> [<intent>] at <where>`; the static guard prints `path:line`. No runtime logging:
  the rules are layout, with no runtime decision points.

## Performance

- The utilities add no JS; `ButtonContent` maps children once per render; `Glyph`'s insets are
  memoised per path. The audit costs two or three screenshots per candidate: seconds per screen.

## Web Experience

- CLS: no host changes size. Hosts that pin a size do so at their probed heights; every other label keeps
  its line box through `text-optical-line`. Edge compensation comes from values computed during render,
  so static pages carry it in their HTML and nothing moves after paint. No fonts are loaded; LCP and
  INP are untouched.

## Accessibility

- The primitives are presentational; ARIA passes through. Trimming changes no text size, colour or
  focus ring. A `GlyphDisc as="button"` needs an `aria-label` from its caller.

## Testing

| Spec rule                                | Test                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| Tolerance, cap band, ink, intent, stacks | `optical-audit.spec.ts`, `optical-audit-sites.spec.ts`                                |
| Utilities                                | `optical-utilities.test.ts`                                                           |
| Primitives and their invariants          | `optical.test.tsx`                                                                    |
| Button labels and edges                  | `Button.test.tsx`                                                                     |
| Header stack row                         | `EditorHeader.test.tsx`                                                               |
| SVG text on its cap band                 | `svg-cap-band.test.ts`, `svg-cap-band-render.test.ts`, `sticker-badge-centre.test.ts` |
| Primitives are the one implementation    | `optical-guard.test.ts` (the checker) and each workspace's `optical-guard.test.ts`    |
