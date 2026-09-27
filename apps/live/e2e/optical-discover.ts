import type { OpticalFailure } from './optical';

// The in-page half of the optical alignment audit (optical.ts runs it): finds the shapes, tags them and
// reads what the DOM can tell. Playwright serialises `discover` into the page, so it stays one
// self-contained function: no imports or module state inside it.

export type Rect = { x: number; y: number; w: number; h: number };
export type Probe = {
  where: string;
  box: Rect;
  // Selector whose content the "bare" screenshot hides.
  hide: string;
  // Hide the probe's descendants (a shape) or the probe itself (SVG text over a circle).
  hideSelf: boolean;
  capBands: { text: string; mid: number }[];
  iconsOnly: boolean;
  // Vertical centring is only asked of a shape that centres, or whose content fills its height.
  vertical: boolean;
  // Another element paints over part of the shape (an avatar stack): its ink cannot be read.
  occluded: boolean;
  // Capitals and digits only (initials, numerals, caps chips): the ink IS the cap band, so it is the truth.
  capsOnly: boolean;
  // Leading-disc chips are held to the concentric rule instead of horizontal centring.
  concentric: { lead: number; vertical: number } | null;
  // Horizontal: null when the shape is not meant to centre (a start-aligned row). A short glyph run
  // (initials, numerals, icons) is judged by ink on both sides; otherwise each side is judged by what
  // sits at it: a word by its advance (its side bearings are the typeface's), anything else by ink.
  horizontal: {
    shortGlyph: boolean;
    intent: string;
    controls: { left: number; right: number } | null;
    text: { left: number; right: number } | null;
    otherLeft: number;
    otherRight: number;
  } | null;
};

// D41: what counts as a shape.
export const SHAPE = { minH: 8, maxH: 44, minW: 8, maxW: 220, maxChars: 28, maxDescendants: 8 };

// Runs in the page: discover candidates, tag them, and measure what the DOM can tell us.
export function discover(args: { attr: string; shape: typeof SHAPE; tol: number }) {
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
    const own = (el.textContent ?? '').trim();
    // A textless shape (an icon tile) is named by the control it sits in, so rows of look-alike tiles are
    // told apart.
    const context = own
      ? ''
      : ` in "${(el.closest('button, a, [role="menuitem"], li')?.textContent ?? '').trim().slice(0, 24)}"`;
    return `${parts.join(' > ')} "${own.slice(0, 24)}"${context}`;
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
  // Text a shape owns: not inside a painted shape nested within it (an avatar disc in a card
  // centres against its disc, which is measured as its own shape).
  const ownText = (root: Element) =>
    textNodes(root).filter((n) => {
      for (let a = n.parentElement; a && a !== root; a = a.parentElement)
        if (painted(a)) return false;
      return true;
    });

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
    for (const n of ownText(el)) {
      const mid = capBandMid(n);
      if (mid !== null) capBands.push({ text: n.data.trim(), mid });
    }
    const cs = getComputedStyle(el);
    // The text's advance, less the trailing letter-space a tracked run carries after its last letter.
    let textLeft = Infinity;
    let textRight = -Infinity;
    for (const n of ownText(el)) {
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
    let grows = false;
    for (const c of el.childNodes) {
      if (c.nodeType === Node.TEXT_NODE) {
        if (!c.textContent?.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(c);
        occupied += range.getBoundingClientRect().width;
        items++;
      } else if (c instanceof Element) {
        const ccs = getComputedStyle(c);
        if (ccs.position === 'absolute' || !visible(c)) continue;
        if (parseFloat(ccs.flexGrow) > 0) grows = true;
        occupied += c.getBoundingClientRect().width;
        items++;
      }
    }
    const gap = cs.display.includes('flex') ? parseFloat(cs.columnGap) || 0 : 0;
    const shrinkWrapped =
      !grows &&
      items > 0 &&
      Math.abs(occupied + gap * (items - 1) - (inner.right - inner.left)) <= 1.5;
    // Why the shape is held to horizontal centring, reported with any failure.
    const intent = /center|space-around|space-evenly/.test(cs.justifyContent)
      ? `justify-content: ${cs.justifyContent}`
      : cs.textAlign === 'center'
        ? 'text-align: center'
        : shrinkWrapped
          ? `shrink-wrapped (${(occupied + gap * (items - 1)).toFixed(1)} of ${(inner.right - inner.left).toFixed(1)}px)`
          : null;
    const centredIntent = intent !== null;
    // Initials and symbols are judged by ink; numerals by their advance, which the typeface
    // designs a leaning "1" or "7" into (optical-alignment.md).
    const shortGlyph = !text || (/^\S{1,3}$/.test(text) && !/^\d+$/.test(text));
    // A shape holding two or more controls (a segmented switch) centres its controls' boxes; a
    // segment's fill is part of the control, not ink to balance against the other side's text.
    const controls = [...el.children].filter((c) =>
      c.matches('button, a, [role="tab"], [role="radio"]'),
    );
    const controlBoxes =
      controls.length >= 2
        ? {
            left: Math.min(...controls.map((c) => c.getBoundingClientRect().left)) - r.left,
            right: Math.max(...controls.map((c) => c.getBoundingClientRect().right)) - r.left,
          }
        : null;
    const innerTop = r.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
    const innerBottom = r.bottom - parseFloat(cs.borderBottomWidth) - parseFloat(cs.paddingBottom);
    let contentTop = Infinity;
    let contentBottom = -Infinity;
    for (const c of el.childNodes) {
      let cr: DOMRect | null = null;
      if (c.nodeType === Node.TEXT_NODE && c.textContent?.trim()) {
        const range = document.createRange();
        range.selectNodeContents(c);
        cr = range.getBoundingClientRect();
      } else if (
        c instanceof Element &&
        getComputedStyle(c).position !== 'absolute' &&
        visible(c)
      ) {
        cr = c.getBoundingClientRect();
      }
      if (!cr) continue;
      contentTop = Math.min(contentTop, cr.top);
      contentBottom = Math.max(contentBottom, cr.bottom);
    }
    const flex = cs.display.includes('flex');
    // A column of two or more items is a stack (icon over label), held by the stack-row check instead:
    // the cap-band rule is for one line of glyphs.
    const inFlow = [...el.children].filter(
      (c) => getComputedStyle(c).position !== 'absolute' && visible(c),
    );
    const stacked = flex && cs.flexDirection.startsWith('column') && inFlow.length >= 2;
    const verticalIntent =
      !stacked &&
      ((flex && !cs.flexDirection.startsWith('column') && cs.alignItems === 'center') ||
        (flex && cs.flexDirection.startsWith('column') && /center/.test(cs.justifyContent)) ||
        (cs.display.includes('grid') && /center/.test(cs.alignItems)) ||
        (Math.abs(contentTop - innerTop) <= 1.5 && Math.abs(contentBottom - innerBottom) <= 1.5));
    // Sample five points: any covered by an element outside the shape means an overlap.
    const occluded = [
      [0.5, 0.5],
      [0.2, 0.5],
      [0.8, 0.5],
      [0.5, 0.2],
      [0.5, 0.8],
    ].some(([fx, fy]) => {
      const top = document.elementFromPoint(r.left + r.width * fx!, r.top + r.height * fy!);
      return top !== null && top !== el && !el.contains(top) && !top.contains(el);
    });
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
      vertical: verticalIntent,
      occluded,
      // Rendered in capitals (by content or text-transform): the text's own ink is its cap band.
      capsOnly:
        capBands.length > 0 &&
        ownText(el).every(
          (n) =>
            /^[A-Z0-9 +]+$/.test(n.data.trim()) ||
            getComputedStyle(n.parentElement!).textTransform === 'uppercase',
        ),
      concentric: leadingDisc ? { lead: fr.left - r.left, vertical: fr.top - r.top } : null,
      horizontal: centredIntent
        ? {
            shortGlyph,
            intent: intent ?? '',
            controls: controlBoxes,
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
        vertical: true,
        occluded: false,
        capsOnly: false,
        concentric: null,
        horizontal: {
          shortGlyph: true,
          intent: 'svg disc',
          controls: null,
          text: null,
          otherLeft: Infinity,
          otherRight: -Infinity,
        },
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
