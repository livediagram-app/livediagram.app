// Quick Select and the edge refinements (docs/specs/031-photo/photo-tools.md "Selecting", "Smart
// selections"): painting grows the selection over areas like the painted ones up to their edges (a
// graph cut in a window around the strokes), and Refine Edge re-decides soft edges like hair by
// where each pixel's colour falls between the subject's and the background's near it.
import { createMask, maskOver, trimMask, type Mask8 } from '../raster/mask';
import { cropRaster, type Raster, type Rect } from '../raster/raster';
import { grabCut, TRIMAP } from './grabcut';

/** The selection after a Quick Select stroke: `painted` (a mask of the brushed pixels) added to
 *  (`subtract` false) or taken from the selection, cut along edges within `reach` px of the stroke.
 *  `r` is the sampled picture (the active layer or the composite), photo coordinates from (0, 0). */
export function quickSelect(
  r: Raster,
  current: Mask8 | null,
  painted: Mask8,
  { subtract = false, reach = 3 }: { subtract?: boolean; reach?: number } = {},
): Mask8 {
  const span = Math.max(painted.width, painted.height);
  const pad = Math.max(16, Math.round(span * reach));
  const win: Rect = {
    x: Math.max(0, painted.x - pad),
    y: Math.max(0, painted.y - pad),
    width: 0,
    height: 0,
  };
  win.width = Math.min(r.width, painted.x + painted.width + pad) - win.x;
  win.height = Math.min(r.height, painted.y + painted.height + pad) - win.y;
  if (win.width <= 2 || win.height <= 2)
    return current ?? createMask({ x: 0, y: 0, width: 0, height: 0 });
  const pic = cropRaster(r, win);
  const sel = current ? maskOver(current, win) : createMask(win);
  const brush = maskOver(painted, win);
  const t = new Uint8Array(win.width * win.height);
  for (let i = 0; i < t.length; i++) {
    const inSel = sel.data[i]! >= 128;
    if (brush.data[i]! >= 128) t[i] = subtract ? TRIMAP.background : TRIMAP.foreground;
    else if (subtract) t[i] = inSel ? TRIMAP.probablyForeground : TRIMAP.background;
    else t[i] = inSel ? TRIMAP.foreground : TRIMAP.probablyBackground;
  }
  // The window's border stays as it was, so the cut never runs past the window's edge.
  for (let y = 0; y < win.height; y++)
    for (let x = 0; x < win.width; x++) {
      if (x > 0 && y > 0 && x < win.width - 1 && y < win.height - 1) continue;
      const i = y * win.width + x;
      if (t[i] === TRIMAP.probablyBackground) t[i] = TRIMAP.background;
      if (t[i] === TRIMAP.probablyForeground) t[i] = TRIMAP.foreground;
    }
  const cut = grabCut(pic, t, 2);
  keepReached(cut, brush.data, sel.data, win.width, win.height, subtract);
  // Merge the window back into the whole selection.
  const bounds = current
    ? {
        x: Math.min(current.x, win.x),
        y: Math.min(current.y, win.y),
        width: Math.max(current.x + current.width, win.x + win.width) - Math.min(current.x, win.x),
        height:
          Math.max(current.y + current.height, win.y + win.height) - Math.min(current.y, win.y),
      }
    : win;
  const out = current ? maskOver(current, bounds) : createMask(bounds);
  for (let y = 0; y < win.height; y++)
    for (let x = 0; x < win.width; x++) {
      const o = (win.y + y - bounds.y) * bounds.width + (win.x + x - bounds.x);
      out.data[o] = cut[y * win.width + x]!;
    }
  return out;
}

/** Only what the stroke reaches changes (photo-tools.md "Smart selections"): the cut can find look-alike areas
 *  anywhere in its window, and those would be selected (or taken out) as islands far from the brush. A changed pixel
 *  stays changed only when it joins the brushed pixels through pixels on the same side of the cut (selected while
 *  adding, unselected while subtracting), 8-connected; the rest go back to how the selection had them. In place. */
function keepReached(
  cut: Uint8Array,
  brush: Uint8Array,
  sel: Uint8Array,
  w: number,
  h: number,
  subtract: boolean,
): void {
  const side = (i: number) => cut[i]! >= 128 !== subtract;
  const reached = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let i = 0; i < cut.length; i++)
    if (brush[i]! >= 128 && side(i)) {
      reached[i] = 1;
      stack.push(i);
    }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    for (let j = -1; j <= 1; j++)
      for (let k = -1; k <= 1; k++) {
        const xx = x + k;
        const yy = y + j;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const n = yy * w + xx;
        if (reached[n] || !side(n)) continue;
        reached[n] = 1;
        stack.push(n);
      }
  }
  for (let i = 0; i < cut.length; i++)
    if (!reached[i] && cut[i]! >= 128 !== sel[i]! >= 128) cut[i] = sel[i]!;
}

/** Re-decides the pixels within `radius` of the selection's edge by colour: each one's alpha is
 *  where its colour falls between the mean of the sure subject and of the sure background near it
 *  (a closed-form colour matte), so wisps of hair come in soft. */
export function refineEdge(r: Raster, selection: Mask8, radius = 6): Mask8 {
  // Room round the selection to find the background in.
  const pad = radius * 3 + 1;
  const m = maskOver(selection, {
    x: selection.x - pad,
    y: selection.y - pad,
    width: selection.width + pad * 2,
    height: selection.height + pad * 2,
  });
  const out: Mask8 = { ...m, data: new Uint8Array(m.data) };
  const w = m.width;
  const h = m.height;
  const d = r.data;
  const px = (x: number, y: number) => ((m.y + y) * r.width + (m.x + x)) * 4;
  const edge = (x: number, y: number) => {
    const v = m.data[y * w + x]!;
    for (const [i, j] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const xx = x + i;
      const yy = y + j;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      if (m.data[yy * w + xx]! >= 128 !== v >= 128) return true;
    }
    return v > 0 && v < 255;
  };
  const band = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (edge(x, y))
        for (let j = -radius; j <= radius; j++)
          for (let i = -radius; i <= radius; i++) {
            const xx = x + i;
            const yy = y + j;
            if (xx >= 0 && yy >= 0 && xx < w && yy < h) band[yy * w + xx] = 1;
          }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!band[y * w + x]) continue;
      if (m.x + x < 0 || m.y + y < 0 || m.x + x >= r.width || m.y + y >= r.height) continue;
      let fr = 0;
      let fg = 0;
      let fb = 0;
      let fn = 0;
      let br = 0;
      let bg = 0;
      let bb = 0;
      let bn = 0;
      const R = radius * 2;
      for (let j = -R; j <= R; j += 2)
        for (let i = -R; i <= R; i += 2) {
          const xx = x + i;
          const yy = y + j;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h || band[yy * w + xx]) continue;
          if (m.x + xx >= r.width || m.y + yy >= r.height || m.x + xx < 0 || m.y + yy < 0) continue;
          const o = px(xx, yy);
          if (m.data[yy * w + xx]! >= 128) {
            fr += d[o]!;
            fg += d[o + 1]!;
            fb += d[o + 2]!;
            fn++;
          } else {
            br += d[o]!;
            bg += d[o + 1]!;
            bb += d[o + 2]!;
            bn++;
          }
        }
      if (!fn || !bn) continue;
      fr /= fn;
      fg /= fn;
      fb /= fn;
      br /= bn;
      bg /= bn;
      bb /= bn;
      const o = px(x, y);
      const vr = fr - br;
      const vg = fg - bg;
      const vb = fb - bb;
      const len2 = vr * vr + vg * vg + vb * vb;
      if (len2 < 100) continue; // the two look alike here: keep what the cut said
      const a = ((d[o]! - br) * vr + (d[o + 1]! - bg) * vg + (d[o + 2]! - bb) * vb) / len2;
      out.data[y * w + x] = Math.round(Math.min(1, Math.max(0, a)) * 255);
    }
  return trimMask(out) ?? out;
}
