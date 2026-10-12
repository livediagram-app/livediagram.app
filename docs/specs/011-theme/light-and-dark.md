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
  `packages/document/src/theme-halves-contrast.test.ts` checks every theme in both halves, and
  `apps/live/lib/tab-looks-contrast.test.ts` every look as a light- and a dark-mode viewer sees it (box text, outline
  and arrow).
- **Custom themes** derive their other half the same way. A viewer who cannot resolve someone else's custom theme
  ([Custom themes](custom-themes.md)) sees it as stored.

## What a viewer sees

- Nothing stored changes when someone looks at a tab. The canvas and each element are **drawn** in the viewer's half:
  a stored colour that is one of the theme's colours, in either half, is drawn as the same role in the viewer's half;
  any other colour is a choice someone made and is drawn as it is.
- Writing follows the writer: a new element takes the writer's half of the theme, and everyone else sees it in theirs.
  Picking a theme or a look applies it in the picker's half.
- Everything that draws a tab for a person follows their half: the canvas, the Map, layer and slide thumbnails,
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
