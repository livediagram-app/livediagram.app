// The white under a picture on the canvas (each product's docs/specs/009-elements/images.md "The white under a
// picture"). A picture is drawn on white in every theme, so a transparent PNG and the bands a `contain` picture leaves
// keep the white they were made on. Where the picture reaches the box's edge, the white stops IMAGE_BACKING_INSET_PX
// short of it: were both drawn to the same edge, both are anti-aliased there, and at a zoom that puts the edge between
// screen pixels the edge pixels blend the picture over part-white ones, a faint light frame round a picture on a dark
// background. Where the picture does not reach the edge (a band), the white still does, so a band's corner meets the
// picture's corner and nothing pokes out past the white.
//
// Pure, and no DOM of its own: the frame's padding insets its background colour (clipped to the content box), and
// each band is an inset box shadow with no blur, which runs to the frame's edge and sits under the picture. Shadows,
// not gradient layers: with 600 letterboxed pictures on screen, gradient bands doubled the frame time of a zoom and
// shadows matched the plain white (measured in Chrome, 2026-11-11). Read by every product's image frame so they agree.

/** How far the white stops short of an edge the picture reaches, in canvas px: a whole screen pixel at 50% zoom and
 *  above on any screen (2 px at 0.5 zoom is 1 CSS px, at least 1 device pixel). */
export const IMAGE_BACKING_INSET_PX = 2;

/** The white itself. */
export const IMAGE_BACKING_COLOUR = '#fff';

/** A rectangle in the box's own canvas px, from its top-left corner. */
export type ImageBackingRect = { x: number; y: number; width: number; height: number };

/** The CSS a frame takes for its white: plain values, so any renderer can spread them into a style. */
export type ImageBackingStyle = {
  padding: number;
  backgroundColor: string;
  backgroundClip: string;
  boxShadow: string;
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
  return {
    padding: IMAGE_BACKING_INSET_PX,
    backgroundColor: IMAGE_BACKING_COLOUR,
    backgroundClip: 'content-box',
    boxShadow: picture ? bandShadows(boxWidth, boxHeight, picture) : 'none',
  };
}

// An inset shadow offset by a band's depth paints exactly that band along one side.
function bandShadows(boxWidth: number, boxHeight: number, picture: ImageBackingRect): string {
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
  return shadows.length ? shadows.join(', ') : 'none';
}

const round = (n: number) => Math.round(n * 100) / 100;
