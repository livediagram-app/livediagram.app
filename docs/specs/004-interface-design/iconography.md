# Iconography

Every icon livediagram draws follows one grammar, so a glyph looks the same weight in the toolbar, a menu, the help centre and on the canvas.

## Vocabulary

- **Outline icon**: single-colour line art on a 24-unit square grid, round caps and joins, painted with `currentColor` (chrome) or the element's stroke colour (canvas).
- **On-screen stroke**: the stroke width a person sees, in CSS pixels: `strokeWidth × renderedSize / viewBox`. Weight is specified in on-screen pixels, never in viewBox units.
- **Chrome icon**: an icon in the application interface (toolbars, menus, panels, dialogs, the help centre, marketing, telemetry).
- **Canvas icon**: a line-art glyph from the Icons catalogue placed on a diagram (`shape: 'icon'`), or shown as a palette thumbnail.
- **Technology tile**: a coloured tile with a white generic glyph ([Technology icons](../010-palette/technology-icons.md)).
- **Art**: pictures that are not icons: marketing feature art, background-pattern thumbnails, style swatches, effect previews, brand marks. Art is outside this grammar.

## Source

- The base vocabulary is [Lucide](https://lucide.dev) (ISC), the maintained successor of Feather (MIT), whose geometry the Icons catalogue already uses.
- Lucide is **vendored, not depended on**: a generator copies the pinned SVG data of the glyphs we use into the repo. No icon library is a runtime dependency, so self-hosting and bundles are unaffected.
- A glyph is drawn in-house only when Lucide has no fitting glyph (floor-plan furniture, livediagram-specific actions, effect previews). In-house glyphs follow the same grid, caps, joins and weight.
- Attribution: the repository's `THIRD_PARTY_NOTICES.md` carries the full Lucide ISC and Feather MIT notices, and the Icons catalogue source points to it.

## Weight

| Rendered size | On-screen stroke |
| ------------- | ---------------- |
| over 12px     | 1.25px           |
| 12px or less  | 1px              |

- The weight holds whatever the viewBox, the rendered size, a CSS resize or a canvas zoom (the stroke is non-scaling), so the same glyph never reads heavier in one place than another.
- 1.25px keeps line art light on 1x screens, where a 1.5px line smears across two pixels and reads as 2px.
- Filled glyphs (play, pause, a filled star for "favourited") are allowed where the filled state carries meaning; they are the exception, not a style.

## Ink insets

- Every glyph exposes the blank margin its drawing leaves on each side, stroke included, in rendered px: `--glyph-ink-l`, `--glyph-ink-r`, `--glyph-ink-t`, `--glyph-ink-b` on the `<svg>`.
- The insets are computed from the glyph's geometry during render (no DOM measurement), so static pages carry them and nothing shifts after paint.
- A glyph whose geometry can't be read (a transform, an opaque child component) carries no insets.
- Containers use them to measure padding to the ink (optical alignment).

## One home, one icon per meaning

- Every chrome icon renders through one icon primitive (`Glyph`), which owns size, weight, caps and joins. App code does not draw raw `<svg>` icons; art is allow-listed.
- Icons used by two or more apps live in `packages/ui/src/icons`; an app's own icons live in its icon modules.
- Each meaning has one glyph (one copy, one duplicate, one share, one folder, one sparkle, one trash, one plus). A second drawing of the same meaning is a bug.
- A glyph's name says what it depicts; a glyph depicts its meaning (align is not a window, reactions are not a sun).

## Canvas icons

- Palette thumbnails render at the chrome weight.
- A placed canvas icon has an **icon weight**: `thin`, `regular` or `bold`, picked in the icon's context menu. `regular` is the default and matches the chrome weight. The stroke is non-scaling, so the weight holds at any element size and zoom.
- Floor-plan furniture is drawn top-down, and no two pieces share a silhouette.

## Technology tiles

- Tiles keep generic glyphs; vendor trademarks are not used. Vercel's mark is replaced by a generic glyph for the same reason.
- The white glyph on a tile follows the outline grammar at the chrome weight for the tile's rendered size.
- Two services of the same provider never share a glyph.

## Guarding

- A glyph's drawn geometry (bounding-box centre, stroke included) sits within 0.5px of its viewBox centre at its rendered size. Glyphs asymmetric by design (the play triangle) carry a named, logged exception.
- A unit test over `packages/ui/src/icons` and `packages/icons` enforces the centring rule.
- A lint rule rejects raw `<svg>` outside the icon homes and the art allow-list.
- A contact sheet of every icon (`pnpm icons:sheet`) renders each glyph at 1x and 4x for review on demand. It is not a CI snapshot: pixel output varies across machines, and the code diff already carries the drawing.

## Relation to optical alignment

- Icons in controls come in size steps of 12, 14, 16, 20 and 24px. Status badges (under 12px) and illustration-scale glyphs sit outside the steps.
- One control family uses one size step, drawn on the 24-unit grid so the ink reads the same size: menu rows and section headers 14px, a menu's icon-only quick-action buttons 16px.
- One glyph carries one meaning: settings are sliders, tools a wrench.
- Icons keep their rendered box sizes when their geometry changes, so layout does not shift.
- Iconography owns the drawing: path data, weight, the vocabulary, the icon primitive, the lint rule and the centring test. Optical alignment (`optical-alignment.md`, landing with that work) owns everything around the glyph: containers, slots, text centring, row baselines and the ink audit. Its primitives take any icon as a child.
