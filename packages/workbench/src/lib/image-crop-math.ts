// Cropping an image on the canvas (docs/specs/009-elements/picture-crop-and-mask.md "Cropping in the editor"), as
// pure geometry: the frame (the box being cropped to) and the whole picture, both in canvas units in the element's
// own frame (its top-left corner at 0, 0, unrotated). The overlay feeds pointer deltas in; Done reads the result.
import {
  cleanImageCrop,
  imageDrawsCover,
  imageLayout,
  type ImageCrop,
  type ImageElement,
} from '@livedocuments/document';

export type CropRect = { x: number; y: number; width: number; height: number };
export type CropSession = {
  frame: CropRect;
  picture: CropRect;
  // Where they stood when cropping started: Done stores nothing while both are still there.
  start: { frame: CropRect; picture: CropRect };
};

// The frame is never smaller than this across, in canvas px.
export const IMAGE_CROP_FRAME_MIN = 24;
// The most a picture is enlarged against its fitted size (400%).
export const IMAGE_CROP_ZOOM_MAX = 4;

export type CropHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const CROP_CORNERS: readonly CropHandle[] = ['nw', 'ne', 'se', 'sw'];
export const CROP_EDGES: readonly CropHandle[] = ['n', 'e', 's', 'w'];

const ratio = (r: { width: number; height: number }) => r.width / r.height;

/** Where cropping starts: the box as the frame, the picture where it is drawn (a whole contain picture covering the
 *  box, so the first drag already crops; a letterboxed crop's frame is the part it shows). */
export function cropSessionStart(
  el: Pick<ImageElement, 'width' | 'height' | 'crop' | 'mask' | 'objectFit'>,
  natural: { width: number; height: number } | null,
): CropSession {
  const box = { width: el.width, height: el.height };
  // A whole contain picture starts covering the box (D251); a cropped one where it is drawn.
  const fit = imageDrawsCover(el) || !el.crop ? 'cover' : 'contain';
  const { part, picture } = imageLayout(box, natural, el.crop, fit);
  const x = Math.max(0, part.x);
  const y = Math.max(0, part.y);
  const frame = {
    x,
    y,
    width: Math.min(box.width, part.x + part.width) - x,
    height: Math.min(box.height, part.y + part.height) - y,
  };
  return { frame, picture, start: { frame, picture } };
}

/** The picture kept covering the frame: grown about the frame's centre if it is smaller, then slid back over it. */
function covered(frame: CropRect, picture: CropRect): CropRect {
  let { x, y, width, height } = picture;
  const grow = Math.max(1, frame.width / width, frame.height / height);
  if (grow > 1) {
    const cx = frame.x + frame.width / 2;
    const cy = frame.y + frame.height / 2;
    x = cx - (cx - x) * grow;
    y = cy - (cy - y) * grow;
    width *= grow;
    height *= grow;
  }
  x = Math.min(frame.x, Math.max(frame.x + frame.width - width, x));
  y = Math.min(frame.y, Math.max(frame.y + frame.height - height, y));
  return { x, y, width, height };
}

/** The picture slid by a delta, never leaving the frame uncovered. */
export function panPicture(s: CropSession, dx: number, dy: number): CropSession {
  const p = s.picture;
  return { ...s, picture: covered(s.frame, { ...p, x: p.x + dx, y: p.y + dy }) };
}

/** The frame with a handle moved by a delta from where the gesture started (`from`), kept on the picture and at
 *  least IMAGE_CROP_FRAME_MIN across; a corner keeps `aspect` (width / height) when one is given. */
export function dragFrame(
  from: CropSession,
  handle: CropHandle,
  dx: number,
  dy: number,
  aspect: number | null,
): CropSession {
  const f = from.frame;
  const p = from.picture;
  const min = IMAGE_CROP_FRAME_MIN;
  let left = f.x;
  let top = f.y;
  let right = f.x + f.width;
  let bottom = f.y + f.height;
  if (handle.includes('w')) left = Math.min(right - min, Math.max(p.x, f.x + dx));
  if (handle.includes('e')) right = Math.max(left + min, Math.min(p.x + p.width, right + dx));
  if (handle.includes('n')) top = Math.min(bottom - min, Math.max(p.y, f.y + dy));
  if (handle.includes('s')) bottom = Math.max(top + min, Math.min(p.y + p.height, bottom + dy));
  if (aspect && handle.length === 2) {
    // The corner opposite the dragged one stays put; the axis the pointer moved further along leads.
    const ax = handle.includes('w') ? right : left;
    const ay = handle.includes('n') ? bottom : top;
    let w = right - left;
    let h = bottom - top;
    if (Math.abs(dx) >= Math.abs(dy) * aspect) h = w / aspect;
    else w = h * aspect;
    // Room on the picture from the fixed corner.
    const roomX = handle.includes('w') ? ax - p.x : p.x + p.width - ax;
    const roomY = handle.includes('n') ? ay - p.y : p.y + p.height - ay;
    const fit = Math.min(1, roomX / w, roomY / h);
    w = Math.max(min, w * fit);
    h = Math.max(min, w / aspect);
    left = handle.includes('w') ? ax - w : ax;
    right = left + w;
    top = handle.includes('n') ? ay - h : ay;
    bottom = top + h;
  }
  return { ...from, frame: { x: left, y: top, width: right - left, height: bottom - top } };
}

/** The picture's width when it just covers the frame (100% zoom). */
function coverWidth(frame: CropRect, picture: CropRect): number {
  return Math.max(frame.width, frame.height * ratio(picture));
}

/** The picture's size against its fitted size: 1 is 100%. */
export function cropZoom(s: CropSession): number {
  return s.picture.width / coverWidth(s.frame, s.picture);
}

/** The picture scaled to `z` times its fitted size (1 to IMAGE_CROP_ZOOM_MAX) about the frame's centre. */
export function zoomPicture(s: CropSession, z: number): CropSession {
  const zoom = Math.min(IMAGE_CROP_ZOOM_MAX, Math.max(1, z));
  const p = s.picture;
  const width = coverWidth(s.frame, p) * zoom;
  const height = width / ratio(p);
  const cx = s.frame.x + s.frame.width / 2;
  const cy = s.frame.y + s.frame.height / 2;
  const rx = (cx - p.x) / p.width;
  const ry = (cy - p.y) / p.height;
  return {
    ...s,
    picture: covered(s.frame, { x: cx - rx * width, y: cy - ry * height, width, height }),
  };
}

/** The largest frame of `aspect` about the frame's centre that fits in the old frame (and so on the picture). */
export function fitAspect(s: CropSession, aspect: number): CropSession {
  const f = s.frame;
  const width = Math.min(f.width, f.height * aspect);
  const height = width / aspect;
  return {
    ...s,
    frame: {
      x: f.x + (f.width - width) / 2,
      y: f.y + (f.height - height) / 2,
      width,
      height,
    },
  };
}

/** Back to the whole picture at the box's size: the frame the box, the picture covering it. */
export function resetCrop(s: CropSession, box: { width: number; height: number }): CropSession {
  const frame = { x: 0, y: 0, width: box.width, height: box.height };
  const a = ratio(s.picture);
  const width = Math.max(box.width, box.height * a);
  const height = width / a;
  return {
    ...s,
    frame,
    picture: { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height },
  };
}

const near = (a: CropRect, b: CropRect) =>
  Math.abs(a.x - b.x) < 0.5 &&
  Math.abs(a.y - b.y) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5;

export type CropResult = { x: number; y: number; width: number; height: number; crop?: ImageCrop };

/** What Done stores: the box moved to the frame (turned with the element about its old centre) and the part of the
 *  picture under it; null when nothing moved. */
export function cropSessionResult(
  el: Pick<ImageElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  s: CropSession,
): CropResult | null {
  if (near(s.frame, s.start.frame) && near(s.picture, s.start.picture)) return null;
  const f = s.frame;
  const p = s.picture;
  const theta = ((el.rotation ?? 0) * Math.PI) / 180;
  const lx = f.x + f.width / 2 - el.width / 2;
  const ly = f.y + f.height / 2 - el.height / 2;
  const cx = el.x + el.width / 2 + lx * Math.cos(theta) - ly * Math.sin(theta);
  const cy = el.y + el.height / 2 + lx * Math.sin(theta) + ly * Math.cos(theta);
  const crop = cleanImageCrop({
    x: (f.x - p.x) / p.width,
    y: (f.y - p.y) / p.height,
    width: f.width / p.width,
    height: f.height / p.height,
  });
  const r = (n: number) => Math.round(n * 100) / 100;
  return {
    x: r(cx - f.width / 2),
    y: r(cy - f.height / 2),
    width: r(f.width),
    height: r(f.height),
    ...(crop ? { crop } : {}),
  };
}

/** A screen delta turned into the element's own frame: divided by the zoom and turned back by its rotation. */
export function localDelta(
  dx: number,
  dy: number,
  zoom: number,
  rotation = 0,
): { dx: number; dy: number } {
  const t = (-rotation * Math.PI) / 180;
  const x = dx / zoom;
  const y = dy / zoom;
  return { dx: x * Math.cos(t) - y * Math.sin(t), dy: x * Math.sin(t) + y * Math.cos(t) };
}
