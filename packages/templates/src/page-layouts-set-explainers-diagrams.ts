// The Explainers diagram layouts (docs/specs/007-editor/illustrate-pages.md "Layouts"): Anatomy (an
// image whose parts leader lines name), How It Works (an image with numbered hotspots and their
// key) and Key Concepts (a hub idea and the six that make it up). Same contract as page-layouts.ts:
// the page's content box in, uncoloured elements out, laid out in proportions of the box.
import { createPinnedArrow, type Anchor, type Element } from '@livediagram/document';
import { kit, type Kit, type LayoutBox } from './page-layout-kit';
import { iconDisc, sourceLine } from './page-layout-parts';
import { explainerHeading, FOOT, leader, sizeToFit } from './page-layouts-set-explainers-parts';

// Each part: its name, a note, and where its marker sits on the image (shares of the image's
// width), top to bottom down each side.
const PARTS_LEFT = [
  ['Headline', 'Says what you do in eight words.', 0.3],
  ['Main button', 'One button, one clear verb.', 0.24],
  ['Benefits', 'Three outcomes, not ten features.', 0.34],
] as const;
const PARTS_RIGHT = [
  ['Hero image', 'The product, in real use.', 0.7],
  ['Social proof', 'A real customer, in their words.', 0.76],
  ['Footer', 'Pricing, answers and a second ask.', 0.66],
] as const;

function anatomy(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = explainerHeading(
    k,
    'Anatomy of a landing page',
    'Six parts that turn a visit into a sign-up.',
  );
  const top = head.top;
  // The image down the middle, a column of labels either side reading in towards it.
  const imgW = k.wide ? Math.min(W * 0.34, (H - top) * 0.8) : W * 0.3;
  const imgX = (W - imgW) / 2;
  const gap = u * 4;
  const colW = imgX - gap;
  const dot = u * 2.4;
  const mark = Math.min(u * 4.5, imgW * 0.1);
  const textW = colW - dot - u * 3;
  const nameSize = sizeToFit(
    textW,
    [...PARTS_LEFT, ...PARTS_RIGHT].map(([n]) => n),
  );
  const nameH = nameSize === 'lg' ? u * 7 : u * 5.5;
  const noteH = u * 13;
  const rowH = (H - top) / PARTS_LEFT.length;
  const els: Element[] = [...head.els, k.image(imgX, top, imgW, H - top)];
  const side = (parts: typeof PARTS_LEFT | typeof PARTS_RIGHT, left: boolean) =>
    parts.forEach(([name, note, at], i) => {
      const y = top + i * rowH + Math.max(0, (rowH - nameH - noteH) / 2);
      const lineY = y + nameH / 2;
      const align = left ? 'right' : 'left';
      const textX = left ? 0 : imgX + imgW + gap + dot + u * 3;
      const end = k.shape(
        'circle',
        left ? colW - dot : imgX + imgW + gap,
        lineY - dot / 2,
        dot,
        dot,
        {
          label: '',
        },
      );
      const spot = k.shape('circle', imgX + imgW * at - mark / 2, lineY - mark / 2, mark, mark, {
        label: '',
      });
      els.push(
        k.text(textX, y, textW, nameH, name, {
          textSize: nameSize,
          textBold: true,
          textAlignX: align,
          textAlignY: 'middle',
        }),
        k.text(textX, y + nameH + u, textW, noteH, note, { textAlignX: align }),
        end,
        spot,
        left ? leader(end.id, 'e', spot.id, 'w') : leader(spot.id, 'e', end.id, 'w'),
      );
    });
  side(PARTS_LEFT, true);
  side(PARTS_RIGHT, false);
  return els;
}

// The heat pump's loop, in order, and where each step's hotspot sits on the image (shares of its
// width and height).
const HEAT_STEPS = [
  ['Absorb', 'A fan draws outdoor air over the coil. Even at -10°C, it holds heat.', 0.2, 0.32],
  ['Compress', 'The compressor squeezes the refrigerant, lifting it to about 50°C.', 0.4, 0.74],
  ['Release', 'The hot refrigerant warms the water that runs to your radiators.', 0.8, 0.38],
  ['Expand', 'A valve drops the pressure, the refrigerant chills, and round it goes.', 0.58, 0.2],
] as const;

function howItWorks(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = explainerHeading(
    k,
    'How a heat pump works',
    'It moves heat from outdoor air, indoors.',
  );
  const top = head.top;
  const bottom = H - u * FOOT;
  // The image, a numbered hotspot on it for each step.
  const image = (x: number, y: number, w: number, h: number) => {
    const m = Math.min(u * 9, w * 0.13, h * 0.2);
    return [
      k.image(x, y, w, h),
      ...HEAT_STEPS.map(([, , ax, ay], i) =>
        k.shape('circle', x + w * ax - m / 2, y + h * ay - m / 2, m, m, {
          label: `${i + 1}`,
          textBold: true,
          textSize: 'lg',
        }),
      ),
    ];
  };
  // The key: a numbered disc, the step's name and its note, the steps in `cols` columns.
  const key = (x: number, y: number, w: number, h: number, cols: number) => {
    const gapX = u * 5;
    const cellW = (w - gapX * (cols - 1)) / cols;
    const rows = HEAT_STEPS.length / cols;
    const cellH = h / rows;
    const d = Math.min(u * 8, cellH * 0.38);
    return HEAT_STEPS.flatMap(([name, note], i) => {
      const cx = x + (i % cols) * (cellW + gapX);
      const cy = y + Math.floor(i / cols) * cellH;
      const tx = cx + d + u * 4;
      return [
        k.shape('circle', cx, cy, d, d, { label: `${i + 1}`, textBold: true, textSize: 'lg' }),
        k.text(tx, cy, cx + cellW - tx, d, name, {
          textSize: 'lg',
          textBold: true,
          textAlignY: 'middle',
        }),
        k.text(tx, cy + d + u, cx + cellW - tx, cellH - d - u * 2, note),
      ];
    });
  };
  // The one figure that sells it: heat out for electricity in.
  const figure = (x: number, y: number, w: number, h: number) => [
    k.title(x, y, w * 0.3, h, '3x'),
    k.text(x + w * 0.34, y, w * 0.66, h, 'the heat out, for each unit of electricity in', {
      textSize: 'lg',
      textAlignY: 'middle',
    }),
  ];
  const source = sourceLine(k, 'Source: say whose test figures these are, and when.');
  const figH = u * 14;
  // Side by side unless the page is clearly taller than wide: the image over the figure on the
  // left, the key down the right.
  if (W >= H * 0.77) {
    const imgW = W * 0.48;
    const colX = imgW + u * 6;
    const imgH = bottom - top - figH - u * 4;
    return [
      ...head.els,
      ...image(0, top, imgW, imgH),
      ...figure(0, top + imgH + u * 4, imgW, figH),
      ...key(colX, top, W - colX, bottom - top, 1),
      source,
    ];
  }
  // Tall: the image across the top, the key two by two under it, the figure at the foot.
  const keyH = Math.min(u * 56, (bottom - top) * 0.46);
  const figY = bottom - figH;
  const keyY = figY - u * 5 - keyH;
  return [
    ...head.els,
    ...image(0, top, W, keyY - u * 5 - top),
    ...key(0, keyY, W, keyH, 2),
    ...figure(0, figY, W, figH),
    source,
  ];
}

// The hub idea and the six that make it up: an icon, a name and a note each.
const CONCEPTS = [
  ['key', 'Long', 'Twelve characters or more. Length beats symbols.'],
  ['message', 'Passphrase', 'Four random words: easy to recall, hard to guess.'],
  ['tag', 'Unique', 'A different one for every account, never reused.'],
  ['lock', 'Managed', 'A manager remembers every one for you.'],
  ['smartphone', 'Two-factor', 'A code on your phone stops a stolen password.'],
  ['eye-off', 'Private', 'No names, birthdays or pets anyone could find.'],
] as const;

function keyConcepts(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = explainerHeading(
    k,
    'What makes a password strong?',
    'One idea, and the six habits behind it.',
  );
  const top = head.top;
  const avail = H - top;
  const nameH = u * 7;
  const noteH = u * 13;
  const els: Element[] = [...head.els];
  const hubLabel = { label: 'Strong password', textBold: true, textSize: 'lg' } as const;
  if (k.wide) {
    // The hub in the middle, three ideas down each side on an arc round it, their words reading
    // away from it.
    const hd = Math.min(avail * 0.55, W * 0.24);
    const hub = k.shape('circle', (W - hd) / 2, top + (avail - hd) / 2, hd, hd, hubLabel);
    els.push(hub);
    const rowH = avail / 3;
    const d = Math.min(u * 12, rowH * 0.5);
    // Up to four lines of note, never past its row.
    const wideNoteH = Math.min(u * 18, rowH - nameH);
    const reach = W * 0.04;
    const hubAnchors: readonly (readonly Anchor[])[] = [
      ['wnw', 'w', 'wsw'],
      ['ene', 'e', 'ese'],
    ];
    // The narrowest words column (the middle row's) sets the names' type.
    const narrowest = (W - hd) / 2 - reach - d * 1.35 - u * 4;
    const nameSize = sizeToFit(
      narrowest,
      CONCEPTS.map(([, n]) => n),
    );
    CONCEPTS.forEach(([iconId, name, note], i) => {
      const left = i < 3;
      const row = i % 3;
      // The middle row reaches further out, so the three sit on an arc.
      const out = reach + (row === 1 ? d * 0.35 : 0);
      const dx = left ? (W - hd) / 2 - out - d : (W + hd) / 2 + out;
      const dy = top + row * rowH + (rowH - d) / 2;
      const { disc, els: discEls } = iconDisc(k, dx, dy, d, iconId);
      const tx = left ? 0 : dx + d + u * 4;
      const tw = left ? dx - u * 4 : W - tx;
      const ty = dy + d / 2 - (nameH + wideNoteH) / 2;
      const align = left ? 'right' : 'left';
      els.push(
        ...discEls,
        k.text(tx, ty, tw, nameH, name, { textSize: nameSize, textBold: true, textAlignX: align }),
        k.text(tx, ty + nameH, tw, wideNoteH, note, { textAlignX: align }),
        createPinnedArrow(hub.id, hubAnchors[left ? 0 : 1]![row]!, disc.id, left ? 'e' : 'w'),
      );
    });
    return els;
  }
  // Tall: three ideas over the hub and three under it, each a disc nearest the hub with its words
  // out beyond it; the whole group centred down the page.
  // A page not much taller than wide (a square, a 4:5 post) keeps its discs and notes compact.
  const squarish = H < W * 1.3;
  const cellW = W / 3;
  const d = Math.min(squarish ? u * 10 : u * 12, cellW * 0.4);
  const tallNoteH = squarish ? u * 9 : noteH;
  const blockH = d + u * 3 + nameH + tallNoteH;
  const room = avail - 2 * blockH;
  const hd = Math.min(W * 0.42, room * 0.8);
  const gapV = Math.min(u * 14, (room - hd) / 2);
  const y0 = top + Math.max(0, (avail - 2 * blockH - hd - 2 * gapV) / 2);
  const hubY = y0 + blockH + gapV;
  const hub = k.shape('circle', (W - hd) / 2, hubY, hd, hd, {
    ...hubLabel,
    textSize: hd < u * 30 ? 'md' : 'lg',
  });
  els.push(hub);
  const hubAnchors: readonly Anchor[] = ['nw', 'n', 'ne', 'sw', 's', 'se'];
  CONCEPTS.forEach(([iconId, name, note], i) => {
    const above = i < 3;
    const cx = (i % 3) * cellW;
    const dy = above ? y0 + nameH + tallNoteH + u * 3 : hubY + hd + gapV;
    const ty = above ? y0 : dy + d + u * 3;
    const { disc, els: discEls } = iconDisc(k, cx + (cellW - d) / 2, dy, d, iconId);
    const c = { textAlignX: 'center' } as const;
    els.push(
      ...discEls,
      k.text(cx + u, ty, cellW - u * 2, nameH, name, { textSize: 'lg', textBold: true, ...c }),
      k.text(cx + u * 2, ty + nameH, cellW - u * 4, tallNoteH, note, c),
      createPinnedArrow(hub.id, hubAnchors[i]!, disc.id, above ? 's' : 'n'),
    );
  });
  return els;
}

export const buildAnatomy = (b: LayoutBox) => anatomy(kit(b));
export const buildHowItWorks = (b: LayoutBox) => howItWorks(kit(b));
export const buildKeyConcepts = (b: LayoutBox) => keyConcepts(kit(b));
