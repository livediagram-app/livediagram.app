import type { Page } from '@playwright/test';
import { discover, SHAPE, type Probe } from './optical-discover';

// Optical alignment audit (docs/specs/004-interface-design/optical-alignment.md; the algorithm is
// .../blueprints/optical-alignment.md, "Ink audit"). Finds every small painted shape that frames a glyph
// and measures how far the glyph sits from the shape's centre: text vertically by its cap band (from the
// face's own metrics), everything else by its INK box (a pixel diff of the shape with and without its
// content). Also checks stack rows (icon over label, side by side) share one line.

export const OPTICAL_TOLERANCE_PX = 0.5;

export type OpticalFailure = { where: string; what: string; offsetPx: number };
export type OpticalReport = { measured: number; failures: OpticalFailure[] };

const PROBE_ATTR = 'data-optical-probe';
const HIDE_STYLE_ID = 'optical-audit-hide';
// D46: summed RGB difference that counts as ink at 4x.
const INK_THRESHOLD = 96;

// Decodes two same-sized PNGs in the page and returns the ink box of their difference, in image px.
async function diffInk(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(
    async ([sa, sb, threshold]) => {
      const read = async (b64: string) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = new OffscreenCanvas(img.width, img.height);
        const x = c.getContext('2d')!;
        x.drawImage(img, 0, 0);
        return x.getImageData(0, 0, img.width, img.height);
      };
      const [da, db] = await Promise.all([read(sa), read(sb)]);
      let top = Infinity;
      let bottom = -1;
      let left = Infinity;
      let right = -1;
      for (let y = 0; y < da.height; y++)
        for (let x = 0; x < da.width; x++) {
          const k = (y * da.width + x) * 4;
          let d = 0;
          for (let ch = 0; ch < 3; ch++)
            d += Math.abs((da.data[k + ch] ?? 0) - (db.data[k + ch] ?? 0));
          if (d > threshold) {
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
            left = Math.min(left, x);
            right = Math.max(right, x);
          }
        }
      return bottom < 0 ? null : { w: da.width, h: da.height, top, bottom, left, right };
    },
    [a.toString('base64'), b.toString('base64'), INK_THRESHOLD] as const,
  );
}

// Swaps (or restores) the tailed capitals in a probe's text nodes for their tail-less twins.
async function swapTails(page: Page, selector: string, on: boolean): Promise<void> {
  await page.evaluate(
    ([sel, swap]) => {
      const root = document.querySelector(sel);
      if (!root) return;
      const store = window as unknown as { __opticalTails?: Map<Text, string> };
      store.__opticalTails ??= new Map();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
        if (swap) {
          if (!/[QJ]/i.test(n.data)) continue;
          store.__opticalTails.set(n, n.data);
          n.data = n.data
            .replace(/Q/g, 'O')
            .replace(/q/g, 'o')
            .replace(/J/g, 'I')
            .replace(/j/g, 'i');
        } else {
          const original = store.__opticalTails.get(n);
          if (original !== undefined) n.data = original;
          store.__opticalTails.delete(n);
        }
      }
    },
    [selector, on] as const,
  );
}

async function setHideRule(page: Page, css: string | null) {
  await page.evaluate(
    ([id, rule]) => {
      document.getElementById(id)?.remove();
      if (!rule) return;
      const s = document.createElement('style');
      s.id = id;
      s.textContent = rule;
      document.head.appendChild(s);
    },
    [HIDE_STYLE_ID, css] as const,
  );
}

export async function auditOptical(page: Page): Promise<OpticalReport> {
  // The audit tags the DOM; tagging a tree React is still hydrating reads as a hydration mismatch.
  await page.waitForLoadState('networkidle');
  await page.mouse.move(0, 0);
  const { probes, stacks } = await page.evaluate(discover, {
    attr: PROBE_ATTR,
    shape: SHAPE,
    tol: OPTICAL_TOLERANCE_PX,
  });
  const failures: OpticalFailure[] = [...stacks];
  const fail = (p: Probe, what: string, offsetPx: number) => {
    if (Math.abs(offsetPx) > OPTICAL_TOLERANCE_PX)
      failures.push({ where: p.where, what, offsetPx: +offsetPx.toFixed(2) });
  };
  for (const p of probes) {
    const midY = p.box.y + p.box.h / 2;
    for (const band of p.capsOnly || !p.vertical ? [] : p.capBands)
      fail(p, `text "${band.text}" cap band, vertical`, band.mid - midY);
    if (p.concentric)
      fail(p, 'leading disc, concentric', p.concentric.lead - p.concentric.vertical);
    // Clip on the device-pixel grid, one pixel out, and keep the shape's exact box inside it: a clip at
    // the shape's fractional edges would snap them and skew every centre by up to a device pixel.
    const dpr = await page.evaluate(() => devicePixelRatio);
    const snap = (v: number, f: (n: number) => number) => f(v * dpr) / dpr;
    const x0 = snap(p.box.x, Math.floor) - 1 / dpr;
    const y0 = snap(p.box.y, Math.floor) - 1 / dpr;
    const clip = {
      x: x0,
      y: y0,
      width: snap(p.box.x + p.box.w, Math.ceil) + 1 / dpr - x0,
      height: snap(p.box.y + p.box.h, Math.ceil) + 1 / dpr - y0,
    };
    // The shape's centre, in the clip's CSS px.
    const cx = p.box.x - x0 + p.box.w / 2;
    const cy = p.box.y - y0 + p.box.h / 2;
    const shot = () => page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
    const all = await shot();
    await setHideRule(
      page,
      p.hideSelf
        ? `${p.hide} { visibility: hidden !important }`
        : `${p.hide} * { visibility: hidden !important } ${p.hide} { -webkit-text-fill-color: transparent !important }`,
    );
    const bare = await shot();
    await setHideRule(page, null);
    const ink = p.occluded ? null : await diffInk(page, all, bare);
    if (!ink) continue;
    const scale = dpr;
    // Pixel k covers [k, k + 1) device px, so an ink run's centre is the mean of its edges.
    const midX = (a: number, b: number) => (a + b + 1) / 2 / scale;
    const h = p.horizontal;
    if (h && !p.concentric) {
      const inkLeft = ink.left / scale;
      const inkRight = (ink.right + 1) / scale;
      const boxLeft = p.box.x - x0;
      const t = h.shortGlyph ? null : h.text;
      // DOM edges are relative to the shape's box; ink edges to the clip.
      const left = h.controls
        ? boxLeft + h.controls.left
        : t && t.left < h.otherLeft
          ? boxLeft + t.left
          : inkLeft;
      const right = h.controls
        ? boxLeft + h.controls.right
        : t && t.right > h.otherRight
          ? boxLeft + t.right
          : inkRight;
      fail(p, `content, horizontal [${h.intent}]`, (left + right) / 2 - cx);
    }
    if (p.iconsOnly && p.vertical) fail(p, 'ink, vertical', midX(ink.top, ink.bottom) - cy);
    if (p.capsOnly && p.vertical) {
      // A tailed capital (Q, J) is read as its tail-less twin (O, I): same cap shape and overshoot, no
      // tail below the baseline. The text is restored straight after the two shots.
      if (p.tailed) await swapTails(page, p.hide, true);
      const all = await shot();
      // The text alone: hide only the glyph fill, so an icon beside it stays out of the reading.
      await setHideRule(
        page,
        `${p.hide}, ${p.hide} * { -webkit-text-fill-color: transparent !important }`,
      );
      const noText = await shot();
      await setHideRule(page, null);
      if (p.tailed) await swapTails(page, p.hide, false);
      const text = await diffInk(page, all, noText);
      if (text) fail(p, 'caps ink, vertical', midX(text.top, text.bottom) - cy);
    }
  }
  await page.evaluate(
    (attr) => document.querySelectorAll(`[${attr}]`).forEach((n) => n.removeAttribute(attr)),
    PROBE_ATTR,
  );
  return { measured: probes.length, failures };
}
