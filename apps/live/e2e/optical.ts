import type { Page } from '@playwright/test';

// Optical alignment audit (docs/specs/004-interface-design/optical-alignment.md; the algorithm is
// .../blueprints/optical-alignment.md, "Ink audit"). Finds every small painted shape that frames a glyph
// and measures how far the glyph sits from the shape's centre: text vertically by its cap band (from the
// face's own metrics), everything else by its INK box (a pixel diff of the shape with and without its
// content). Also checks stack rows (icon over label, side by side) share one line.

export const OPTICAL_TOLERANCE_PX = 0.5;

export type OpticalFailure = { where: string; what: string; offsetPx: number };
export type OpticalReport = { measured: number; failures: OpticalFailure[] };

type Rect = { x: number; y: number; w: number; h: number };
type Probe = {
  where: string;
  box: Rect;
  // Selector whose content the "bare" screenshot hides.
  hide: string;
  // Hide the probe's descendants (a shape) or the probe itself (SVG text over a circle).
  hideSelf: boolean;
  capBands: { text: string; mid: number }[];
  iconsOnly: boolean;
  // Capitals and digits only (initials, numerals, caps chips): the ink IS the cap band, so it is the truth.
  capsOnly: boolean;
  // Leading-disc chips are held to the concentric rule instead of horizontal centring.
  concentric: { lead: number; vertical: number } | null;
  // Horizontal: null when the shape is not meant to centre (a start-aligned row). A short glyph run
  // (initials, numerals, icons) is judged by ink on both sides; otherwise each side is judged by what
  // sits at it: a word by its advance (its side bearings are the typeface's), anything else by ink.
  horizontal: {
    shortGlyph: boolean;
    text: { left: number; right: number } | null;
    otherLeft: number;
    otherRight: number;
  } | null;
};

const PROBE_ATTR = 'data-optical-probe';
const HIDE_STYLE_ID = 'optical-audit-hide';
// D41: what counts as a shape.
const SHAPE = { minH: 8, maxH: 44, minW: 8, maxW: 220, maxChars: 28, maxDescendants: 8 };
// D46: summed RGB difference that counts as ink at 4x.
const INK_THRESHOLD = 96;

// Runs in the page: discover candidates, tag them, and measure what the DOM can tell us.
function discover(args: { attr: string; shape: typeof SHAPE; tol: number }) {
  const { attr, shape, tol } = args;
  const clear = (c: string) => c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c);
  const painted = (el: Element) => {
    const cs = getComputedStyle(el);
    return (
      !clear(cs.backgroundColor) ||
      cs.backgroundImage !== 'none' ||
      (parseFloat(cs.borderTopWidth) > 0 && !clear(cs.borderTopColor)) ||
      /\b0px 0px 0px [1-9]/.test(cs.boxShadow)
    );
  };
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    return (
      r.width > 0 &&
      r.height > 0 &&
      r.bottom > 0 &&
      r.right > 0 &&
      r.top < innerHeight &&
      r.left < innerWidth &&
      el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    );
  };
  const describe = (el: Element) => {
    const parts: string[] = [];
    for (let n: Element | null = el; n && parts.length < 3; n = n.parentElement) {
      const label = n.getAttribute('aria-label') || n.getAttribute('data-testid');
      parts.unshift(label ? `${n.tagName.toLowerCase()}[${label}]` : n.tagName.toLowerCase());
    }
    return `${parts.join(' > ')} "${(el.textContent ?? '').trim().slice(0, 24)}"`;
  };
  const rectOf = (el: Element) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  };
  const ctx = document.createElement('canvas').getContext('2d')!;
  const capBandMid = (node: Text) => {
    const host = node.parentElement!;
    const cs = getComputedStyle(host);
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = ctx.measureText('H');
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getClientRects()[0];
    if (!rect) return null;
    return rect.top + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent / 2;
  };
  const textNodes = (root: Element) => {
    const out: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null)
      if (n.data.trim() && !n.parentElement?.closest('svg')) out.push(n);
    return out;
  };

  const probes: Probe[] = [];
  const tag = (el: Element) => {
    const id = String(probes.length);
    el.setAttribute(attr, id);
    return `[${attr}="${id}"]`;
  };

  for (const el of document.querySelectorAll<HTMLElement>('body *')) {
    if (el.closest('[data-optical-ignore]') || el.closest('svg')) continue;
    if (el.matches('input, textarea, select')) continue;
    const r = el.getBoundingClientRect();
    if (
      r.height < shape.minH ||
      r.height > shape.maxH ||
      r.width < shape.minW ||
      r.width > shape.maxW
    )
      continue;
    if (!visible(el) || !painted(el)) continue;
    const text = (el.textContent ?? '').trim();
    const icons = el.querySelectorAll('svg').length;
    if ((!text && !icons) || text.length > shape.maxChars) continue;
    if (el.querySelectorAll('*').length > shape.maxDescendants) continue;
    if (el.querySelector('input, textarea, img, canvas, video')) continue;
    const capBands: Probe['capBands'] = [];
    for (const n of textNodes(el)) {
      const mid = capBandMid(n);
      if (mid !== null) capBands.push({ text: n.data.trim(), mid });
    }
    const cs = getComputedStyle(el);
    // The text's advance, less the trailing letter-space a tracked run carries after its last letter.
    let textLeft = Infinity;
    let textRight = -Infinity;
    for (const n of textNodes(el)) {
      const range = document.createRange();
      range.selectNodeContents(n);
      const tr = range.getBoundingClientRect();
      const ls = parseFloat(getComputedStyle(n.parentElement!).letterSpacing) || 0;
      textLeft = Math.min(textLeft, tr.left);
      textRight = Math.max(textRight, tr.right - ls);
    }
    const text0 = textRight > -Infinity ? { left: textLeft, right: textRight } : null;
    let otherLeft = Infinity;
    let otherRight = -Infinity;
    for (const d of el.querySelectorAll('*')) {
      const inSvg = d.parentElement?.closest('svg');
      if (inSvg) continue;
      if (d.tagName.toLowerCase() !== 'svg' && !painted(d)) continue;
      if (!visible(d)) continue;
      const dr = d.getBoundingClientRect();
      otherLeft = Math.min(otherLeft, dr.left);
      otherRight = Math.max(otherRight, dr.right);
    }
    const inner = {
      left: r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft),
      right: r.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight),
    };
    // Shrink-wrapped: the in-flow children, their text and the gaps fill the inner width, with no free
    // space for a start / space-between layout to hide in (a padded trailing button still counts).
    let occupied = 0;
    let items = 0;
    for (const c of el.childNodes) {
      if (c.nodeType === Node.TEXT_NODE) {
        if (!c.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(c);
        occupied += range.getBoundingClientRect().width;
        items++;
      } else if (c instanceof Element) {
        if (getComputedStyle(c).position === 'absolute' || !visible(c)) continue;
        occupied += c.getBoundingClientRect().width;
        items++;
      }
    }
    const gap = cs.display.includes('flex') ? parseFloat(cs.columnGap) || 0 : 0;
    const shrinkWrapped =
      items > 0 && Math.abs(occupied + gap * (items - 1) - (inner.right - inner.left)) <= 1.5;
    const centredIntent =
      /center|space-around|space-evenly/.test(cs.justifyContent) ||
      cs.textAlign === 'center' ||
      shrinkWrapped;
    const shortGlyph = !text || /^\S{1,3}$/.test(text);
    const first = el.firstElementChild;
    const fr = first?.getBoundingClientRect();
    const leadingDisc =
      first &&
      fr &&
      text.length > 0 &&
      painted(first) &&
      fr.height >= r.height - 10 &&
      Math.abs(fr.width - fr.height) < 1 &&
      parseFloat(getComputedStyle(first).borderTopLeftRadius) >= fr.height / 2 - 1;
    probes.push({
      where: describe(el),
      box: rectOf(el),
      hide: tag(el),
      hideSelf: false,
      capBands,
      iconsOnly: icons > 0 && capBands.length === 0,
      capsOnly: capBands.length > 0 && icons === 0 && /^[A-Z0-9]{1,3}$/.test(text),
      concentric: leadingDisc ? { lead: fr.left - r.left, vertical: fr.top - r.top } : null,
      horizontal: centredIntent
        ? {
            shortGlyph,
            text: text0 ? { left: text0.left - r.left, right: text0.right - r.left } : null,
            otherLeft: otherLeft - r.left,
            otherRight: otherRight - r.left,
          }
        : null,
    });
  }

  // SVG discs: text drawn over a circle, centred against the circle.
  for (const circle of document.querySelectorAll('svg circle')) {
    if (circle.closest('[data-optical-ignore]') || !visible(circle)) continue;
    const c = circle.getBoundingClientRect();
    if (c.height < shape.minH || c.height > shape.maxH * 2) continue;
    for (const t of circle.parentElement?.querySelectorAll(':scope > text') ?? []) {
      const tr = t.getBoundingClientRect();
      if (
        !visible(t) ||
        tr.left < c.left - 1 ||
        tr.right > c.right + 1 ||
        tr.top < c.top - 1 ||
        tr.bottom > c.bottom + 1
      )
        continue;
      probes.push({
        where: `svg disc ${describe(t)}`,
        box: { x: c.x, y: c.y, w: c.width, h: c.height },
        hide: tag(t),
        hideSelf: true,
        capBands: [],
        iconsOnly: true,
        capsOnly: false,
        concentric: null,
        horizontal: { shortGlyph: true, text: null, otherLeft: Infinity, otherRight: -Infinity },
      });
    }
  }

  // Stack rows: column-flex siblings sharing a top edge, each an icon (first child) over a label.
  const stacks: OpticalFailure[] = [];
  const seen = new Set<Element>();
  for (const el of document.querySelectorAll('body *')) {
    const parent = el.parentElement;
    if (!parent || seen.has(parent) || el.closest('[data-optical-ignore]')) continue;
    seen.add(parent);
    const rows = [...parent.children].flatMap((item) => {
      const cs = getComputedStyle(item);
      const r = item.getBoundingClientRect();
      if (!visible(item) || !cs.display.includes('flex') || cs.flexDirection !== 'column')
        return [];
      if (r.height < 24 || r.height > 72) return [];
      const glyph = item.firstElementChild;
      const labels = textNodes(item);
      const last = labels.at(-1);
      if (!glyph || !last || glyph.contains(last)) return [];
      const g = glyph.getBoundingClientRect();
      const label = capBandMid(last);
      if (label === null || g.bottom > label) return [];
      return [{ item, top: r.top, label, glyph: g.top + g.height / 2 }];
    });
    const ref = rows[0];
    if (!ref) continue;
    const row = rows.filter((x) => Math.abs(x.top - ref.top) <= 1);
    if (row.length < 2) continue;
    for (const x of row.slice(1)) {
      const at = `${describe(x.item)} vs ${describe(ref.item)}`;
      if (Math.abs(x.label - ref.label) > tol)
        stacks.push({
          where: at,
          what: 'stack row label cap band',
          offsetPx: +(x.label - ref.label).toFixed(2),
        });
      if (Math.abs(x.glyph - ref.glyph) > tol)
        stacks.push({
          where: at,
          what: 'stack row glyph centre',
          offsetPx: +(x.glyph - ref.glyph).toFixed(2),
        });
    }
  }
  return { probes, stacks };
}

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
  await page.waitForLoadState("networkidle");
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
    for (const band of p.capsOnly ? [] : p.capBands)
      fail(p, `text "${band.text}" cap band, vertical`, band.mid - midY);
    if (p.concentric)
      fail(p, 'leading disc, concentric', p.concentric.lead - p.concentric.vertical);
    const clip = { x: p.box.x, y: p.box.y, width: p.box.w, height: p.box.h };
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
    const ink = await diffInk(page, all, bare);
    if (!ink) continue;
    const scale = ink.w / p.box.w;
    const h = p.horizontal;
    if (h && !p.concentric) {
      const inkLeft = ink.left / scale;
      const inkRight = (ink.right + 1) / scale;
      const t = h.shortGlyph ? null : h.text;
      const left = t && t.left < h.otherLeft ? t.left : inkLeft;
      const right = t && t.right > h.otherRight ? t.right : inkRight;
      fail(p, 'content, horizontal', (left + right) / 2 - p.box.w / 2);
    }
    if (p.iconsOnly || p.capsOnly)
      fail(p, 'ink, vertical', ((ink.top + ink.bottom) / 2 - (ink.h - 1) / 2) / scale);
  }
  await page.evaluate(
    (attr) => document.querySelectorAll(`[${attr}]`).forEach((n) => n.removeAttribute(attr)),
    PROBE_ATTR,
  );
  return { measured: probes.length, failures };
}
