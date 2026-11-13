// The white under a picture on the canvas (each product's docs/specs/009-elements/images.md "The white under a
// picture"). A picture is drawn on white in every theme, so a transparent PNG and the bands a `contain` picture leaves
// keep the white they were made on. Where the picture reaches the box's edge, the white stops short of it (at least a
// device pixel at any zoom): were both drawn to the same edge, both are anti-aliased there, and at a zoom that puts the
// edge between screen pixels the edge pixels blend the picture over part-white ones, a faint light frame round a
// picture on a dark background. Where the picture does not reach the edge (a band), the white still does, so a band's
// corner meets the picture's corner and nothing pokes out past the white.
//
// Pure, and no DOM of its own: the frame's padding insets its background colour (clipped to the content box), and
// each band is an inset box shadow with no blur on a layer of its own with square corners under the picture, which
// the frame's rounded clip trims. On the rounded frame itself the shadow's inner edge would follow the corner radius
// and leave a white fillet where a band meets the picture at the box's edge. Shadows, not gradient layers: with 600
// letterboxed pictures on screen, gradient bands doubled the frame time of a zoom and shadows matched the plain white
// (measured in Chrome, 2026-11-11). Read by every product's image frame so they agree.

/** How far the white stops short of an edge the picture reaches, in canvas px: a whole screen pixel at 50% zoom and
 *  above on any screen (2 px at 0.5 zoom is 1 CSS px, at least 1 device pixel). */
export const IMAGE_BACKING_INSET_PX = 2;

/** The CSS variable each picture's frame reads for its inset; outside any canvas (a thumbnail, a preview) it is unset
 *  and the frame falls back to IMAGE_BACKING_INSET_PX. */
export const IMAGE_BACKING_INSET_VAR = '--lw-image-backing-inset';

/** The attribute the canvas's zoomed layer carries, its inset in canvas px (imageBackingInsetAttribute), and the one
 *  each picture's frame carries: the editor's stylesheet (@liveworkspace/workbench/image-backing.css) sets the
 *  variable on the frames under a layer whose inset is more than IMAGE_BACKING_INSET_PX, one rule a step. An
 *  attribute and a rule that names the frames, not the variable on the layer: a variable set on the layer is
 *  inherited by every node under it, so each step restyled the whole board (6,086 nodes and about 120 ms a step on
 *  the reference board), where the rule restyles the frames alone. */
export const IMAGE_BACKING_INSET_ATTRIBUTE = 'data-image-inset';
export const IMAGE_FRAME_ATTRIBUTE = 'data-image-frame';

/** The largest inset, in canvas px: a device pixel down to a zoom of 1/256 (the canvas stops at 1/20). */
export const IMAGE_BACKING_INSET_MAX_PX = 256;

/** The insets above IMAGE_BACKING_INSET_PX the stylesheet has a rule for, smallest first. */
export const IMAGE_BACKING_INSET_STEPS: readonly number[] = Array.from(
  { length: Math.log2(IMAGE_BACKING_INSET_MAX_PX / IMAGE_BACKING_INSET_PX) },
  (_, i) => IMAGE_BACKING_INSET_PX * 2 ** (i + 1),
);

/** The inset at this zoom on this screen, in canvas px: IMAGE_BACKING_INSET_PX while that is a device pixel or more
 *  (zoom times device pixel ratio of 0.5 and up), else the next power of two at or above one device pixel, up to
 *  IMAGE_BACKING_INSET_MAX_PX. Stepped, so zooming out changes it only at a few thresholds and zooming above half a
 *  device pixel per canvas px never does. */
export function imageBackingInsetPx(zoom: number, devicePixelRatio: number): number {
  const devicePxPerCanvasPx = zoom * devicePixelRatio;
  if (!(devicePxPerCanvasPx > 0) || devicePxPerCanvasPx * IMAGE_BACKING_INSET_PX >= 1) {
    return IMAGE_BACKING_INSET_PX;
  }
  return Math.min(IMAGE_BACKING_INSET_MAX_PX, 2 ** Math.ceil(Math.log2(1 / devicePxPerCanvasPx)));
}

/** The attribute the canvas's zoomed layer spreads in (IMAGE_BACKING_INSET_ATTRIBUTE), so every picture under it
 *  takes the inset its zoom needs from CSS alone: no picture re-renders on zoom, and the value is the same string at
 *  every zoom above the threshold. */
export function imageBackingInsetAttribute(
  zoom: number,
  // This screen's, where there is one (a value read, never a layout read), else 1.
  devicePixelRatio: number = (globalThis as { devicePixelRatio?: number }).devicePixelRatio ?? 1,
): Record<typeof IMAGE_BACKING_INSET_ATTRIBUTE, string> {
  return { [IMAGE_BACKING_INSET_ATTRIBUTE]: String(imageBackingInsetPx(zoom, devicePixelRatio)) };
}

/** The stylesheet's rules, one a step (what @liveworkspace/workbench/image-backing.css holds; its test checks). */
export function imageBackingInsetRules(): string {
  return IMAGE_BACKING_INSET_STEPS.map(
    (px) =>
      `[${IMAGE_BACKING_INSET_ATTRIBUTE}='${px}'] [${IMAGE_FRAME_ATTRIBUTE}] {\n  ${IMAGE_BACKING_INSET_VAR}: ${px}px;\n}`,
  ).join('\n');
}

/** The white itself. */
export const IMAGE_BACKING_COLOUR = '#fff';

/** A rectangle in the box's own canvas px, from its top-left corner. */
export type ImageBackingRect = { x: number; y: number; width: number; height: number };

/** The CSS a frame takes for its white: plain values, so any renderer can spread them into a style. `frame` goes on
 *  the picture's rounded, clipped frame; `bands`, when the picture leaves any, on a layer filling the frame under the
 *  picture with no corner radius of its own. */
export type ImageBackingStyle = {
  frame: { padding: string; backgroundColor: string; backgroundClip: string };
  bands: { boxShadow: string } | null;
};

// A band thinner than this is no band: the picture reaches that edge.
const BAND_EPSILON_PX = 0.01;

/** Where a `contain` picture of the natural size sits in a box: as large as fits, centred (CSS `object-fit:
 *  contain` at its default `object-position`). Null when either size is empty. */
export function containedPictureRect(
  boxWidth: number,
  boxHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): ImageBackingRect | null {
  if (!(boxWidth > 0 && boxHeight > 0 && naturalWidth > 0 && naturalHeight > 0)) return null;
  const scale = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height };
}

/** The white for a box of this size with the picture drawn over `picture` (null: over the whole box, as a `cover`
 *  picture is, or one whose size is not known yet). The white is the box inset by IMAGE_BACKING_INSET_PX, plus every
 *  band the picture leaves bare (above, below, left, right of it), each running to the box's edge. */
export function imageBackingStyle(
  boxWidth: number,
  boxHeight: number,
  picture: ImageBackingRect | null,
): ImageBackingStyle {
  const bands = picture ? bandShadows(boxWidth, boxHeight, picture) : null;
  return {
    frame: {
      padding: `var(${IMAGE_BACKING_INSET_VAR}, ${IMAGE_BACKING_INSET_PX}px)`,
      backgroundColor: IMAGE_BACKING_COLOUR,
      backgroundClip: 'content-box',
    },
    bands: bands ? { boxShadow: bands } : null,
  };
}

// An inset shadow offset by a band's depth paints exactly that band along one side.
function bandShadows(
  boxWidth: number,
  boxHeight: number,
  picture: ImageBackingRect,
): string | null {
  const top = Math.max(0, picture.y);
  const left = Math.max(0, picture.x);
  const bottom = boxHeight - Math.min(boxHeight, picture.y + picture.height);
  const right = boxWidth - Math.min(boxWidth, picture.x + picture.width);
  const shadows: string[] = [];
  const band = (x: number, y: number) =>
    shadows.push(`inset ${round(x)}px ${round(y)}px 0 0 ${IMAGE_BACKING_COLOUR}`);
  if (top > BAND_EPSILON_PX) band(0, top);
  if (bottom > BAND_EPSILON_PX) band(0, -bottom);
  if (left > BAND_EPSILON_PX) band(left, 0);
  if (right > BAND_EPSILON_PX) band(-right, 0);
  return shadows.length ? shadows.join(', ') : null;
}

const round = (n: number) => Math.round(n * 100) / 100;
