// Logo-design template lifted out of template-builders.ts: a 2x2
// lockup sheet so the user can pick the brand composition they want
// (horizontal vs vertical icon placement, with or without tagline)
// and delete the others. The dispatcher buildLogoDesign lays out
// the four cells and delegates each one's composition to the
// private buildLogoLockup helper, which builds the icon + brand
// (+ optional tagline) text elements for a single lockup.
//
// Mirrors the sibling template-builders-* split pattern (boards,
// wireframes): one file per coherent template family, parent
// dispatcher imports the public entrypoint by name. See spec/09
// "Templates" for the catalogue.
//
// Each builder is still pure: takes a centre (cx, cy), returns a
// fresh Element[].

import { createShape, createText, type Element } from '@livediagram/diagram';

// Logo-design lockup sheet: four common wordmark compositions on one
// canvas. Top row is icon-left (horizontal lockup), bottom row is
// icon-above (vertical lockup); the right column adds a tagline.
// Layout uses a 2x2 grid of "cells" centred on (cx, cy); each cell
// hosts one lockup laid out around its own centre point. Users pick
// the variant they want, delete the others, and replace the
// placeholder circle icon with a real shape or image.
export function buildLogoDesign(cx: number, cy: number): Element[] {
  const cellW = 460;
  const cellH = 260;
  const colGap = 32;
  const rowGap = 32;
  const cellCenter = (col: 0 | 1, row: 0 | 1) => ({
    x: cx - cellW / 2 - colGap / 2 + col * (cellW + colGap),
    y: cy - cellH / 2 - rowGap / 2 + row * (cellH + rowGap),
  });
  const variants: { orientation: 'horizontal' | 'vertical'; tagline: boolean; cell: 0 | 1 }[] = [
    { orientation: 'horizontal', tagline: false, cell: 0 },
    { orientation: 'horizontal', tagline: true, cell: 1 },
    { orientation: 'vertical', tagline: false, cell: 0 },
    { orientation: 'vertical', tagline: true, cell: 1 },
  ];
  const out: Element[] = [];
  for (let i = 0; i < variants.length; i++) {
    const v = variants[i]!;
    const row: 0 | 1 = i < 2 ? 0 : 1;
    const c = cellCenter(v.cell, row);
    out.push(...buildLogoLockup(c.x, c.y, v.orientation, v.tagline));
  }
  return out;
}

// One wordmark lockup, centred on (cx, cy). Placeholder circle icon
// + a "Brand" wordmark, plus an optional "Tagline goes here" line
// underneath. Spacing is small enough that the four lockups fit on
// the default canvas viewport without overlap.
function buildLogoLockup(
  cx: number,
  cy: number,
  orientation: 'horizontal' | 'vertical',
  tagline: boolean,
): Element[] {
  const iconSize = 72;
  const brandW = 220;
  const brandH = 48;
  const taglineW = 220;
  const taglineH = 32;
  const gap = 16;

  if (orientation === 'horizontal') {
    const textBlockH = brandH + (tagline ? 4 + taglineH : 0);
    const compositionW = iconSize + gap + brandW;
    const startX = cx - compositionW / 2;
    const iconY = cy - iconSize / 2;
    const textX = startX + iconSize + gap;
    const textTop = cy - textBlockH / 2;
    const els: Element[] = [
      {
        ...createShape('circle', startX, iconY),
        width: iconSize,
        height: iconSize,
        label: 'Logo',
        textSize: 'sm' as const,
      },
      {
        ...createText(textX, textTop),
        width: brandW,
        height: brandH,
        label: 'Brand',
        textSize: 'lg' as const,
      },
    ];
    if (tagline) {
      els.push({
        ...createText(textX, textTop + brandH + 4),
        width: taglineW,
        height: taglineH,
        label: 'Tagline goes here',
        textSize: 'sm' as const,
      });
    }
    return els;
  }

  const compositionH = iconSize + gap + brandH + (tagline ? 4 + taglineH : 0);
  const top = cy - compositionH / 2;
  const iconX = cx - iconSize / 2;
  const brandX = cx - brandW / 2;
  const taglineX = cx - taglineW / 2;
  const els: Element[] = [
    {
      ...createShape('circle', iconX, top),
      width: iconSize,
      height: iconSize,
      label: 'Logo',
      textSize: 'sm' as const,
    },
    {
      ...createText(brandX, top + iconSize + gap),
      width: brandW,
      height: brandH,
      label: 'Brand',
      textSize: 'lg' as const,
    },
  ];
  if (tagline) {
    els.push({
      ...createText(taglineX, top + iconSize + gap + brandH + 4),
      width: taglineW,
      height: taglineH,
      label: 'Tagline goes here',
      textSize: 'sm' as const,
    });
  }
  return els;
}
