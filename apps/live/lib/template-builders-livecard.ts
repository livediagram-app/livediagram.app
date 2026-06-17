// "Live card" template builder. A collaborative greeting-card lockup:
// a left panel with a hero image placeholder and a bold title, and a
// right panel that is a board of four message rows (avatar image +
// message text, each row grouped so it moves as a unit). Lifted from a
// hand-built reference diagram and re-centred on the supplied canvas
// point.
//
// The image elements are empty placeholders (imageId: null) so the
// template ships no bytes: each renders the dashed "drop an image"
// thumbnail until the user picks one. Group ids are minted fresh per
// build so two instantiations never share a group.

import { createImage, createShape, createText, type Element } from '@livediagram/diagram';

const PANEL_FILL = '#e0e7ff';
const PANEL_STROKE = '#4338ca';
const TEXT = '#312e81';

// Side panels (left = hero + title, right = message board).
const LEFT_PANEL = { x: -768, y: -479, w: 762, h: 958 };
const RIGHT_PANEL = { x: 7, y: -479, w: 762, h: 958 };
const HERO = { x: -732, y: -443, w: 690, h: 517 };
const TITLE = { x: -732, y: 93, w: 690, h: 73 };

// Right-panel message rows: each a grouped (slot + avatar + message).
const ROW = {
  slotX: 34,
  slotW: 708,
  slotH: 183,
  imgX: 53,
  imgW: 200,
  imgH: 150,
  txtX: 266,
  txtW: 456,
  txtH: 150,
};
const ROWS: { slotY: number; innerY: number; label: string }[] = [
  { slotY: -443, innerY: -427, label: 'Happy birthday, Sandra! Hope it is a great one.' },
  { slotY: -246, innerY: -228, label: 'Wishing you all the best this year!' },
  { slotY: -47, innerY: -28, label: 'So lucky to work with you. Enjoy your day!' },
  { slotY: 156, innerY: 175, label: 'Have a wonderful birthday and a relaxing weekend.' },
];

function panel(x: number, y: number, w: number, h: number): Element {
  return {
    ...createShape('square', x, y),
    width: w,
    height: h,
    fillColor: PANEL_FILL,
    strokeColor: PANEL_STROKE,
    textColor: TEXT,
  };
}

export function buildLiveCard(cx: number, cy: number): Element[] {
  const elements: Element[] = [];

  // Background panels.
  elements.push(panel(cx + LEFT_PANEL.x, cy + LEFT_PANEL.y, LEFT_PANEL.w, LEFT_PANEL.h));
  elements.push(panel(cx + RIGHT_PANEL.x, cy + RIGHT_PANEL.y, RIGHT_PANEL.w, RIGHT_PANEL.h));

  // Left panel: hero image placeholder + bold title.
  elements.push({
    ...createImage(cx + HERO.x, cy + HERO.y),
    width: HERO.w,
    height: HERO.h,
  });
  elements.push({
    ...createText(cx + TITLE.x, cy + TITLE.y),
    width: TITLE.w,
    height: TITLE.h,
    label: 'Happy Birthday Sandra!',
    textSize: 'scale',
    textBold: true,
    textColor: TEXT,
  });

  // Right panel: four grouped message rows.
  for (const r of ROWS) {
    const groupId = crypto.randomUUID();
    elements.push({
      ...createShape('square', cx + ROW.slotX, cy + r.slotY),
      width: ROW.slotW,
      height: ROW.slotH,
      fillColor: PANEL_FILL,
      strokeColor: PANEL_STROKE,
      textColor: TEXT,
      strokeWidth: 'thin',
      strokeStyle: 'dashed',
      groupId,
    });
    elements.push({
      ...createImage(cx + ROW.imgX, cy + r.innerY),
      width: ROW.imgW,
      height: ROW.imgH,
      groupId,
    });
    elements.push({
      ...createText(cx + ROW.txtX, cy + r.innerY),
      width: ROW.txtW,
      height: ROW.txtH,
      label: r.label,
      textSize: 'md',
      textColor: TEXT,
      groupId,
    });
  }

  return elements;
}
