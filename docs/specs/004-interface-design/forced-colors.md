# Forced colours

Status: shipped

## What

Every app (editor, help centre, telemetry dashboard, marketing site) stays usable when the operating system
forces its own colours: Windows contrast themes, and any browser setting that matches `@media (forced-colors: active)`.
The browser repaints the chrome with a short list of system colours (Canvas, CanvasText, ButtonText, Highlight, ...),
drops gradients and shadows, and keeps images. That repaint is the default and stays the default: the app does not
opt whole screens out of it.

## Why

A forced palette removes every colour the author chose, so anything that says something **only** with a fill, a
gradient or a shadow says nothing. Before this spec, in a dark contrast theme:

- Every switch (Settings' Alignment Guides, Auto-Attach Arrows, ...) disappeared: a filled track and thumb with no
  border, both repainted as the page's own Canvas colour.
- A segmented control (Element Indicators: Top, Footer, Off) and every pressed toggle showed no chosen option.
- Every colour swatch was an empty square, so a colour could not be picked.
- Every template preview (the editor's template step, the Explorer, the marketing gallery) was a flat blank box: the
  dark re-lighting veil (`preview-art-tile`) was repainted black and blended the art away.
- The tour and sign-in banners, painted only with a gradient, turned see-through over the canvas.

## The rule

- **State is never a fill alone.** A control whose chosen state is its fill shows it with the system's selection
  colours under forced colours: a checked radio or menu radio (`aria-checked="true"`), a pressed toggle
  (`aria-pressed="true"`) and a selected tab or option (`aria-selected="true"`) take a 2 px Highlight ring inside
  their edge (not while the focus ring, drawn with the same outline, shows). A ring, never a Highlight fill: the
  browser draws a Canvas backplate behind forced text, which hid a filled option's label.
  The shared theme does this for every app, keyed on the ARIA state each control already carries, so a new control
  that states its role and state gets it for free.
- **A switch keeps its own colours** (`role="switch"`, `forced-color-adjust: none`): its on and off tracks and its
  thumb are drawn as designed, since a switch has no system colour pair that says "on".
- **Colour that is the content keeps it.** A swatch chip, the custom colour editor's plane, hue slider and chips, and a
  tool option's colour dot show the colour they stand for (`forced-color-adjust-none`); so do template previews,
  which are pictures of a canvas. The chrome around them is repainted as usual.
- **A floating surface has a solid fill.** A banner, card or panel over other content that is painted with a gradient
  also sets a solid background colour under it (the gradient's end), so with gradients dropped it is still opaque.
- The canvas, which is the user's own content, keeps the colours it is drawn with: element fills and strokes are SVG
  presentation colours, which forced colours keep.

## How

- `packages/tailwind-config/theme.css`, `@media (forced-colors: active)`, unlayered so it outranks the utilities that
  paint a control's chosen state: the ARIA-state Highlight rule and the switch rule.
- `packages/template-previews/src/preview-art-tile.css`: the tile and its veil keep their colours.
- `apps/live/components/colour/ColourSwatch.tsx` (`SwatchChip`), `CustomColourEditor.tsx`,
  `apps/live/components/panels/ToolOptionRow.tsx`: `forced-color-adjust-none` on the colour itself.
- `apps/live/components/tour/TourBanner.tsx`, `apps/live/components/chrome/SignInBanner.tsx`: a solid background
  under the gradient.

## Testing

Emulate it in Playwright with `forcedColors: 'active'` (light and dark `colorScheme`); re-apply `page.emulateMedia`
before each capture, since the emulation can lapse after a navigation while the media query still matches.
