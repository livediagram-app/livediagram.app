// Framework-canvas templates: the nine-block Business Model Canvas, plus a
// re-export of the empathy map (./template-builders-empathy, split out once
// its persona card and Pains / Gains strip grew it). Both are "fill the
// boxes" strategy canvases (a grid of labelled regions seeded with starter
// content); the freeform workshop boards live in template-builders-workshops.ts.
//
// Each builder is pure: it takes a centre (cx, cy) and returns a fresh
// Element[]. Sizing constants live inline so each template is
// self-describing. See docs/specs/008-canvas/canvas-and-palette.md "Templates" for the catalogue.

import { createShape, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
export { buildEmpathyMap } from './template-builders-empathy';

// The classic Business Model Canvas: nine blocks in the canonical
// Osterwalder arrangement (partners / activities+resources / value
// propositions / relationships+channels / segments over a costs +
// revenue base row). Every block carries its title, a role glyph, and
// starter notes for a worked example (a meal-kit subscription) so the
// canvas reads as a filled-in model to overwrite, not an empty form.
// Block chrome is left to the theme; only the structure is pinned.
export function buildBusinessModelCanvas(cx: number, cy: number): Element[] {
  const colW = 296;
  const gap = 12;
  const colPitch = colW + gap;
  const topH = 560; // full-height columns (partners / value props / segments)
  const halfH = (topH - gap) / 2; // stacked half blocks (activities over resources, etc.)
  const baseH = 220; // costs + revenue base row
  const baseW = (5 * colW + 4 * gap - gap) / 2;
  const titleH = 46;
  const titleGap = 28;

  const totalW = 5 * colW + 4 * gap;
  const totalH = titleH + titleGap + topH + gap + baseH;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const gridTop = y0 + titleH + titleGap;

  type Block = {
    title: string;
    icon: string;
    x: number;
    y: number;
    w: number;
    h: number;
    notes: string[];
  };

  // The worked example: "FreshBox", a weekly meal-kit subscription.
  // Concrete enough that each block's intent is obvious at a glance.
  const blocks: Block[] = [
    {
      title: 'Key Partners',
      icon: 'link',
      x: 0,
      y: 0,
      w: colW,
      h: topH,
      notes: ['Local farms', 'Courier network'],
    },
    {
      title: 'Key Activities',
      icon: 'zap',
      x: colPitch,
      y: 0,
      w: colW,
      h: halfH,
      notes: ['Recipe development', 'Weekly fulfilment'],
    },
    {
      title: 'Key Resources',
      icon: 'box',
      x: colPitch,
      y: halfH + gap,
      w: colW,
      h: halfH,
      notes: ['Cold-chain kitchen', 'Subscriber base'],
    },
    {
      title: 'Value Propositions',
      icon: 'heart',
      x: colPitch * 2,
      y: 0,
      w: colW,
      h: topH,
      notes: ['Fresh dinners in 20 minutes', 'Zero-waste portions', 'No planning, no shopping'],
    },
    {
      title: 'Customer Relationships',
      icon: 'message',
      x: colPitch * 3,
      y: 0,
      w: colW,
      h: halfH,
      notes: ['Weekly menu email', 'In-app chef support'],
    },
    {
      title: 'Channels',
      icon: 'send',
      x: colPitch * 3,
      y: halfH + gap,
      w: colW,
      h: halfH,
      notes: ['Website + app', 'Food bloggers'],
    },
    {
      title: 'Customer Segments',
      icon: 'users',
      x: colPitch * 4,
      y: 0,
      w: colW,
      h: topH,
      notes: ['Busy professionals', 'Health-minded families'],
    },
    {
      title: 'Cost Structure',
      icon: 'credit-card',
      x: 0,
      y: topH + gap,
      w: baseW,
      h: baseH,
      notes: ['Ingredients + packaging', 'Last-mile delivery'],
    },
    {
      title: 'Revenue Streams',
      icon: 'dollar-sign',
      x: baseW + gap,
      y: topH + gap,
      w: baseW,
      h: baseH,
      notes: ['Weekly subscriptions', 'One-off gift boxes'],
    },
  ];

  const elements: Element[] = [];

  // Canvas title above the grid; a natural rename target.
  elements.push({
    ...createText(x0, y0),
    width: totalW,
    height: titleH,
    label: 'Business Model Canvas · FreshBox meal kits',
    textSize: 'lg',
    textBold: true,
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });

  const pad = 16;
  const iconSize = 30;
  const headerH = 36;
  const noteH = 34;
  const noteGap = 8;
  for (const b of blocks) {
    const bx = x0 + b.x;
    const by = gridTop + b.y;
    // Block container first so the header / icon / notes layer above it.
    elements.push({
      ...createShape('square', bx, by),
      width: b.w,
      height: b.h,
      textSize: 'md',
      strokeWidth: 'thin',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    elements.push({
      ...createText(bx + pad, by + pad),
      width: b.w - pad * 2 - iconSize,
      height: headerH,
      label: b.title,
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    elements.push({
      ...createShape('icon', bx + b.w - pad - iconSize, by + pad),
      width: iconSize,
      height: iconSize,
      iconId: b.icon,
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    b.notes.forEach((note, i) => {
      elements.push({
        ...createText(bx + pad, by + pad + headerH + noteGap + i * (noteH + noteGap)),
        width: b.w - pad * 2,
        height: noteH,
        label: `• ${note}`,
        textSize: 'sm',
        textAlignX: 'left',
        layerId: TEMPLATE_CONTENT_LAYER_ID,
      });
    });
  }

  return elements;
}
