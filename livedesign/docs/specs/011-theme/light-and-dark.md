# Light and dark halves

Every colour theme works in both appearances. A theme has a **light half** and a **dark half**, and each person sees
a tab in the half that matches their own appearance ([Live app](../007-editor/live-app.md#appearance-light--dark--system)):
two people in different modes look at the same tab at the same time, each in their own half. Default has always worked
this way ([Canvas and palette](../008-canvas/canvas-and-palette.md#default-scheme-dark-half)); every other theme now
does too, so the editor never asks anyone to switch mode to suit a tab.

## The halves

- A built-in theme is written as one half, its **native half** (a light canvas makes it a light theme, a dark canvas a
  dark one). Its other half is **derived** from it, keeping every colour's hue:
  - into dark: the canvas becomes a deep tint of the theme's hue, the pattern a shade above it, fills dark and muted,
    outlines and arrows bright, text near white;
  - into light: the canvas becomes a pale tint, the pattern a soft shade, fills light, outlines and arrows deep, text
    dark.
- Every colour a theme paints is covered: canvas, pattern, element fill, outline and text, each branch of a
  multi-colour palette and its root, and each shape kind's colours in a per-shape theme (UML).
- **Contrast.** Both halves meet WCAG 2.2 AA: text on its fill at 4.5:1 or more, outlines and arrows against the canvas
  at 3:1 or more. Where a derived (or a native) colour falls short, its lightness is moved away from what it sits on
  until it passes, keeping its hue.
  `packages/design/src/theme-halves-contrast.test.ts` checks every theme in both halves, and
  `apps/live/lib/tab-looks-contrast.test.ts` every look as a light- and a dark-mode viewer sees it (box text, outline
  and arrow).
- **Style presets meet the same floor.** Every shape preset's label reads on its fill at 4.5:1 or more in both halves
  of every theme, and every table preset's header title on its band. Bold stays white text, so its fill darkens until
  white reads on it; any other short label (Solid's white on a mid accent, the Border tier's accent on white) is walked
  away from its fill. A preset that already read is unchanged. The shared walk lives in
  `packages/design/src/readable-colour.ts`; `packages/design/src/theme-presets.test.ts` checks every preset.

## What a viewer sees

- Nothing stored changes when someone looks at a tab. The canvas and each element are **drawn** in the viewer's half:
  a stored colour that is one of the theme's colours, in either half, is drawn as the same role in the viewer's half;
  any other colour is a choice someone made and is drawn as it is.
- **A box's text and fill are drawn as a pair.** Each colour is redrawn on its own, so a box whose fill is one of the
  theme's colours but whose text is someone's choice (a template's white box with slate text) would get the half's
  fill under the stored text. Where that would put the text on its fill below 4.5:1, and read worse than the stored
  pair does, the box keeps its stored fill and text instead (its outline still follows the half). `packages/design/src/theme-halves.test.ts` covers the rule, and
  `apps/live/lib/template-theme-contrast.test.ts` every template under every theme, for a light- and a dark-mode
  viewer.
- **A theme never sinks a label into what is behind it.** Picking a theme or a look, or drawing a tab in the other
  half, repaints each colour on its own, so it can move a label's backdrop (a panel the theme paints, the canvas)
  without its ink, or the ink without the backdrop: a template's dark `PAPER_INK` on a panel a dark theme repaints
  deep brown, or its slate caption on a canvas that turned dark. Wherever that leaves a label under 3:1 against what is
  behind it (the same backdrop as above) and reading worse than before, the label's ink is walked in lightness, its
  hue and chroma kept, until it reaches 3:1 (`withReadableLabelInks`, `packages/design/src/label-backdrop.ts`, on
  `reachContrast`). A pick stores the walked ink, as it stores the rest of the theme; a view only draws it. A label no
  theme touched keeps its ink however low it reads, since that is someone's choice. livedesign never runs the walk:
  every tab is pages, and their words sit on pages with their own paper, not on the canvas. `apps/live/lib/template-overlay-contrast.test.ts` holds every
  template's labels at 3:1 under every theme, picked in either half and seen in either
  ([#819](https://github.com/livedesign-app/livedesign.app/issues/819)).
- **A page's own paper.** An element on a page with a fill of its own (a solid, a gradient, an
  image) is drawn for that page, not for the viewer's chrome: its theme colours in the half whose surface matches
  the page's (a light page takes the light half, a dark one the dark half), its stock colours for that surface. A
  layout placed on a light page in Steel keeps its dark words in dark chrome, where the dark half's light ink would
  sink into the page. Elements on plain paper (no fill) follow the chrome as before, since the paper does. The canvas
  (`usePageView`, `apps/live/lib/stock-colour-projector.ts`) and every export (`tabAsSeen`) draw it the same way.
- **A Border-tier preset is a line drawing on the paper.** Hairline, Outline, Dotted, Dash-Dot and Frame sit on white
  in a light half and, in a dark half, on that half's element fill (the dark ink's for a theme that paints none, as
  Default), their lines and labels lightened to read there. A white card on a dark canvas glared. A preset-styled box is redrawn by the preset it wears (`colorPreset`), not only by its
  colours, so a white that two presets share (Paper keeps its white in both halves) maps to the right one.
- **A shape styled with an earlier preset follows too.** A shape styled before presets met the floor stores the
  colours they had then; those are read as the same preset, so the box is drawn as today's version of it (a stored
  Bold of white on a mid-tone fill is drawn with the darker fill).
- Writing follows the writer: a new element takes the writer's half of the theme, and everyone else sees it in theirs.
  Picking a theme or a look applies it in the picker's half.
- Everything that draws a tab for a person follows their half: the canvas, the Map, layer and page thumbnails,
  exports made from the editor, the palette's tile tint, the theme and look previews in Tab Style, and the quick
  style swatches. Server-made images (thumbnails, the MCP's inline renders) have no viewer and draw what is stored.

## The match prompt is gone

The prompt that offered to switch the editor's mode to suit a tab's theme ("This tab uses a light theme") is removed,
and so is the theme browser's "Turn on Dark mode" switch: no theme needs a particular mode any more.

## Retired: Autumn and Jewel

Autumn and Jewel leave the catalogue, being too close to other multi-colour themes. A tab saved on either is migrated on
load ([Retired colour schemes](retired-schemes.md)): Autumn becomes **Tropical**, Jewel becomes **Rainbow**, and every
element colour still equal to what the retired theme painted becomes the new theme's colour for the same role; a colour
someone picked is kept.

## Telemetry

None new: theme picks keep `Theme · Changed · <Theme>`.
