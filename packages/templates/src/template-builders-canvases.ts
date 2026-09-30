// Framework-canvas templates: the nine-block Business Model Canvas, plus a
// re-export of the empathy map (./template-builders-empathy, split out once
// its persona card and Pains / Gains strip grew it). Both are "fill the
// boxes" strategy canvases (a grid of labelled regions seeded with starter
// content); the freeform workshop boards live in template-builders-workshops.ts.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. See docs/specs/008-canvas/canvas-and-palette.md "Templates".

import { createShape, createSticky, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
export { buildEmpathyMap } from './template-builders-empathy';

// The Business Model Canvas, filled in for a believable business (FreshBox,
// a weekly meal-kit subscription) so it reads as a model to overwrite rather
// than a form to fear. The nine blocks keep Osterwalder's arrangement
// (partners / activities + resources / value propositions / relationships +
// channels / segments over costs + revenue), but the canvas is coloured by
// what each block is ABOUT, the four areas the method groups them into:
// infrastructure (blue), the offer (amber), customers (green) and finances
// (violet), keyed by chips on the title row. Every block is a tinted
// container with a deep-hue header and a role glyph, seeded with sticky
// notes in its own hue, because a canvas is worked by moving notes around.
// The Value Propositions block is the visual heart: a thick border, a big
// headline note and a sparkle sticker. A numbered chip on each block's
// corner gives the order the canvas is filled in (customers first, costs
// last), which is the thing newcomers most often get wrong. Headers are
// sized so the longest ("Customer Relationships") sits on one line.
type Area = {
  fill: string;
  stroke: string;
  header: string;
  sticky: { fill: string; text: string };
};

const AREAS = {
  infrastructure: {
    fill: '#dbeafe',
    stroke: '#93c5fd',
    header: '#1d4ed8',
    sticky: { fill: '#bae6fd', text: '#082f49' },
  },
  offer: {
    fill: '#fef3c7',
    stroke: '#f59e0b',
    header: '#b45309',
    sticky: { fill: '#fde68a', text: '#451a03' },
  },
  customers: {
    fill: '#dcfce7',
    stroke: '#86efac',
    header: '#15803d',
    sticky: { fill: '#bbf7d0', text: '#052e16' },
  },
  finances: {
    fill: '#ede9fe',
    stroke: '#c4b5fd',
    header: '#6d28d9',
    sticky: { fill: '#e9d5ff', text: '#3b0764' },
  },
} satisfies Record<string, Area>;

type AreaId = keyof typeof AREAS;

// The title-row key: one chip per area, in the canvas's left-to-right order.
const AREA_KEY: { area: AreaId; label: string }[] = [
  { area: 'infrastructure', label: 'Infrastructure' },
  { area: 'offer', label: 'Offer' },
  { area: 'customers', label: 'Customers' },
  { area: 'finances', label: 'Finances' },
];

type Block = {
  title: string;
  icon: string;
  area: AreaId;
  // Fill order (1 = start here).
  step: number;
  // Grid slot: column (0..4) and row part ('full' spans the top area,
  // 'upper' / 'lower' are its stacked halves, 'base' is the bottom row,
  // where col 0 / 1 pick the left / right half).
  col: number;
  part: 'full' | 'upper' | 'lower' | 'base';
  notes: string[];
};

const BMC_BLOCKS: Block[] = [
  {
    title: 'Key Partners',
    icon: 'link',
    area: 'infrastructure',
    step: 8,
    col: 0,
    part: 'full',
    notes: [
      'Six family farms within 50 miles',
      'Courier network with 2-hour delivery slots',
      'Recipe creators on a revenue share',
    ],
  },
  {
    title: 'Key Activities',
    icon: 'zap',
    area: 'infrastructure',
    step: 7,
    col: 1,
    part: 'upper',
    notes: ['Develop 12 new recipes a week', 'Pick, pack and ship 9,000 boxes'],
  },
  {
    title: 'Key Resources',
    icon: 'box',
    area: 'infrastructure',
    step: 6,
    col: 1,
    part: 'lower',
    notes: ['Cold-chain kitchen in Leeds', 'Taste data from 2,400 subscribers'],
  },
  {
    title: 'Value Propositions',
    icon: 'heart',
    area: 'offer',
    step: 2,
    col: 2,
    part: 'full',
    notes: [
      'Dinner on the table in 20 minutes: no planning, no shopping',
      'Portioned to the gram, so nothing is wasted',
      'Farm-fresh, traceable ingredients',
    ],
  },
  {
    title: 'Customer Relationships',
    icon: 'message',
    area: 'customers',
    step: 4,
    col: 3,
    part: 'upper',
    notes: ['Weekly menu email with one-tap swaps', 'In-app chef chat, 7 days a week'],
  },
  {
    title: 'Channels',
    icon: 'send',
    area: 'customers',
    step: 3,
    col: 3,
    part: 'lower',
    notes: ['App and website', 'Food creators on Instagram'],
  },
  {
    title: 'Customer Segments',
    icon: 'users',
    area: 'customers',
    step: 1,
    col: 4,
    part: 'full',
    notes: [
      'Busy professionals cooking for two',
      'Young families who dread the weekly shop',
      'Fitness fans who meal-prep',
    ],
  },
  {
    title: 'Cost Structure',
    icon: 'credit-card',
    area: 'finances',
    step: 9,
    col: 0,
    part: 'base',
    notes: ['Ingredients · 38% of revenue', 'Packaging + cold chain · 14%', 'Delivery · 12%'],
  },
  {
    title: 'Revenue Streams',
    icon: 'dollar-sign',
    area: 'finances',
    step: 5,
    col: 1,
    part: 'base',
    notes: [
      'Weekly plan · £39 for 3 dinners',
      'Gift boxes · £55 one-off',
      'Add-ons: desserts, wine',
    ],
  },
];

export function buildBusinessModelCanvas(cx: number, cy: number): Element[] {
  const colW = 380;
  const gap = 16;
  const pad = 18;
  const headerH = 40;
  const iconSize = 32;
  const noteGap = 12;
  const halfNoteH = 64;
  const fullNoteH = 96;
  const heroNoteH = 132;
  const baseNoteH = 72;
  const chipSize = 32;
  const titleH = 48;
  const captionH = 28;
  const headGap = 36;
  const notesTop = pad + headerH + noteGap;
  const halfH = notesTop + 2 * halfNoteH + noteGap + pad;
  const topH = halfH * 2 + gap;
  const baseH = notesTop + baseNoteH + pad;
  const totalW = 5 * colW + 4 * gap;
  const baseW = (totalW - gap) / 2;
  const totalH = titleH + captionH + headGap + topH + gap + baseH;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const gridTop = y0 + titleH + captionH + headGap;

  const scaffold = { layerId: TEMPLATE_SCAFFOLD_LAYER_ID };
  const content = { layerId: TEMPLATE_CONTENT_LAYER_ID };
  const elements: Element[] = [
    {
      ...createText(x0, y0),
      width: totalW / 2,
      height: titleH,
      label: 'FreshBox meal kits · Business Model Canvas',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
      ...content,
    },
    {
      ...createText(x0, y0 + titleH),
      width: totalW,
      height: captionH,
      label:
        'Fill it in the numbered order: who you serve and what you promise them first, what it costs last. One idea per sticky.',
      textSize: 'sm',
      textColor: '#64748b',
      textAlignX: 'left',
      ...scaffold,
    },
  ];

  // The area key, right-aligned on the title row.
  const keyW = 150;
  const keyGap = 10;
  const keyH = 32;
  AREA_KEY.forEach((k, i) => {
    const area = AREAS[k.area];
    elements.push({
      ...createShape(
        'stadium',
        x0 + totalW - (AREA_KEY.length - i) * (keyW + keyGap) + keyGap,
        y0 + (titleH - keyH) / 2,
      ),
      width: keyW,
      height: keyH,
      label: k.label,
      textSize: 'sm',
      textBold: true,
      fillColor: area.fill,
      strokeColor: area.stroke,
      textColor: area.header,
      themeLockFill: true,
      ...scaffold,
    });
  });

  const slot = (b: Block): { x: number; y: number; w: number; h: number } => {
    if (b.part === 'base') {
      return { x: x0 + b.col * (baseW + gap), y: gridTop + topH + gap, w: baseW, h: baseH };
    }
    const x = x0 + b.col * (colW + gap);
    if (b.part === 'full') return { x, y: gridTop, w: colW, h: topH };
    return { x, y: gridTop + (b.part === 'lower' ? halfH + gap : 0), w: colW, h: halfH };
  };

  for (const b of BMC_BLOCKS) {
    const area = AREAS[b.area];
    const hero = b.area === 'offer';
    const { x, y, w, h } = slot(b);
    elements.push({
      ...createShape('square', x, y),
      width: w,
      height: h,
      fillColor: area.fill,
      strokeColor: area.stroke,
      strokeWidth: hero ? 'thick' : 'thin',
      ...scaffold,
    });
    elements.push(
      {
        ...createText(x + pad, y + pad),
        width: w - pad * 2 - iconSize - 8,
        height: headerH,
        label: b.title,
        textSize: 'md',
        textBold: true,
        textAlignX: 'left',
        textColor: area.header,
        ...scaffold,
      },
      {
        ...createShape('icon', x + w - pad - iconSize, y + pad + (headerH - iconSize) / 2),
        width: iconSize,
        height: iconSize,
        iconId: b.icon,
        strokeColor: area.header,
        ...scaffold,
      },
      // The fill-order chip rides the block's top-left corner, clear of the
      // header text, so the sequence reads across the whole canvas.
      {
        ...createShape('circle', x - chipSize / 2 + 2, y - chipSize / 2 + 2),
        width: chipSize,
        height: chipSize,
        label: String(b.step),
        textSize: 'sm',
        textBold: true,
        fillColor: area.sticky.fill,
        strokeColor: area.header,
        textColor: area.header,
        themeLockFill: true,
        ...scaffold,
      },
    );

    const innerW = w - pad * 2;
    const noteY = y + notesTop;
    const note = (label: string, nx: number, ny: number, nw: number, nh: number, big = false) =>
      elements.push({
        ...createSticky(nx, ny),
        width: nw,
        height: nh,
        label,
        textSize: big ? 'md' : 'sm',
        fillColor: area.sticky.fill,
        textColor: area.sticky.text,
        ...content,
      });
    if (b.part === 'base') {
      const nw = (innerW - noteGap * (b.notes.length - 1)) / b.notes.length;
      b.notes.forEach((n, i) => note(n, x + pad + i * (nw + noteGap), noteY, nw, baseNoteH));
    } else if (hero) {
      // The headline promise gets the big note; the proof points follow.
      let ny = noteY;
      b.notes.forEach((n, i) => {
        const nh = i === 0 ? heroNoteH : halfNoteH;
        note(n, x + pad, ny, innerW, nh, i === 0);
        ny += nh + noteGap;
      });
      const stickerSize = 64;
      elements.push({
        ...createShape('sticker', x + w - pad - stickerSize, y + h - pad - stickerSize),
        width: stickerSize,
        height: stickerSize,
        stickerId: 'emoji-sparkles',
        ...content,
      });
    } else {
      const nh = b.part === 'full' ? fullNoteH : halfNoteH;
      b.notes.forEach((n, i) => note(n, x + pad, noteY + i * (nh + noteGap), innerW, nh));
    }
  }

  return elements;
}
