// The social layouts (docs/specs/007-editor/illustrate-pages.md "Layouts"): an announcement, a
// "Did you know?" fact and a save the date. Same contract as page-layouts.ts: the page's content box
// in, uncoloured elements out, a tall page stacking and a wide one setting side by side. Each is a
// single block, centred down the page so nothing floats in empty space.
import type { Element } from '@livediagram/document';
import { kit, type Kit, type LayoutBox } from './page-layout-kit';
import { iconDisc, SOURCE_H, sourceLine } from './page-layout-parts';

function announcement(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const badgeH = u * 8;
  const titleH = u * 18;
  const lineH = u * 16;
  const ctaH = u * 14;
  const lead = 'One place for every project, shared with your whole team.';
  const badge = (x: number, y: number) =>
    k.shape('square', x, y, u * 20, badgeH, {
      label: 'New',
      textBold: true,
      borderRadius: 'full',
    });
  const cta = (x: number, y: number, w: number) =>
    k.shape('square', x, y, w, ctaH, {
      label: 'Try it today',
      textBold: true,
      textSize: 'lg',
      borderRadius: 'full',
    });
  if (k.wide) {
    // The words as one block centred down the left, the image filling the right.
    const colW = W * 0.44;
    const blockH = badgeH + u * 4 + titleH + u * 4 + lineH + u * 8 + ctaH;
    const y = Math.max(0, (H - blockH) / 2);
    const titleY = y + badgeH + u * 4;
    const lineY = titleY + titleH + u * 4;
    return [
      badge(0, y),
      k.title(0, titleY, colW, titleH, 'Meet Spaces'),
      k.text(0, lineY, colW, lineH, lead, { textSize: 'lg' }),
      cta(0, lineY + lineH + u * 8, Math.min(colW, u * 56)),
      k.image(W * 0.5, 0, W * 0.5, H),
    ];
  }
  const imgY = badgeH + titleH + lineH + u * 12;
  return [
    badge(0, 0),
    k.title(0, badgeH + u * 4, W, titleH, 'Meet Spaces'),
    k.text(0, badgeH + titleH + u * 6, W * 0.9, lineH, lead, { textSize: 'lg' }),
    k.image(0, imgY, W, H - imgY - ctaH - u * 6),
    cta(0, H - ctaH, Math.min(W * 0.6, u * 56)),
  ];
}

const FACT = 'Honey never spoils: pots 3,000 years old are still good to eat.';

function didYouKnow(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const titleH = u * 12;
  // The fact set large: page type scaled up, as Quote sets its words.
  const fact = (x: number, y: number, w: number, h: number, align: 'left' | 'center') =>
    k.text(x, y, w, h, FACT, { textSize: 'lg', textScale: k.wide ? 1.8 : 1.5, textAlignX: align });
  const disc = (x: number, y: number, d: number) => iconDisc(k, x, y, d, 'zap').els;
  const source = sourceLine(k, 'Source: say where this fact comes from.');
  // The room above the source line, which the block is centred in.
  const room = H - u * (SOURCE_H + 4);
  if (k.wide) {
    const d = Math.min(room * 0.7, W * 0.3);
    const x = d + u * 10;
    const factH = room * 0.5;
    const blockH = titleH + u * 4 + factH;
    const y = Math.max(0, (room - blockH) / 2);
    return [
      ...disc(0, (room - d) / 2, d),
      k.title(x, y, W - x, titleH, 'Did you know?'),
      fact(x, y + titleH + u * 4, W - x, factH, 'left'),
      source,
    ];
  }
  const d = Math.min(W * 0.42, room * 0.3);
  const factH = room * 0.3;
  const blockH = d + u * 8 + titleH + u * 4 + factH;
  const y = Math.max(0, (room - blockH) / 2);
  const titleY = y + d + u * 8;
  return [
    ...disc((W - d) / 2, y, d),
    { ...k.title(0, titleY, W, titleH, 'Did you know?'), textAlignX: 'center' },
    fact(0, titleY + titleH + u * 4, W, factH, 'center'),
    source,
  ];
}

// A calendar tile: the month on a band across its top, the day set large, the weekday under it.
function calendarTile(k: Kit, x: number, y: number, w: number, h: number): Element[] {
  const { u } = k;
  const bandH = h * 0.24;
  return [
    k.shape('square', x, y, w, h, { label: '', borderRadius: 'lg' }),
    k.shape('square', x, y, w, bandH, {
      label: 'NOVEMBER',
      textBold: true,
      textSize: 'lg',
      borderRadius: 'lg',
    }),
    { ...k.title(x, y + bandH + h * 0.04, w, h * 0.5, '14'), textAlignX: 'center' },
    k.text(x, y + h - u * 4 - h * 0.14, w, h * 0.14, 'Saturday', {
      textSize: 'lg',
      textAlignX: 'center',
      textAlignY: 'middle',
    }),
  ];
}

function saveTheDate(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const titleH = u * 14;
  const nameH = u * 12;
  const whereH = u * 8;
  const where = 'The Old Library, Market Street';
  const more = 'More soon: the invitation follows in October.';
  if (k.wide) {
    // The tile on the left, the words as one block centred down the right.
    const tileH = H * 0.8;
    const tileW = Math.min(tileH * 0.9, W * 0.4);
    const x = tileW + u * 12;
    const colW = W - x;
    const blockH = titleH + u * 8 + nameH + u * 3 + whereH + u * 8 + u * 6;
    const y = Math.max(0, (H - blockH) / 2);
    const nameY = y + titleH + u * 8;
    return [
      ...calendarTile(k, 0, (H - tileH) / 2, tileW, tileH),
      k.title(x, y, colW, titleH, 'Save the date'),
      k.title(x, nameY, colW, nameH, 'Summer Meetup'),
      k.text(x, nameY + nameH + u * 3, colW, whereH, where, { textSize: 'lg' }),
      k.text(x, nameY + nameH + whereH + u * 11, colW, u * 6, more),
    ];
  }
  // Stacked and centred: the headline at the top, "More soon" at the foot, the tile, the event's
  // name and where centred between them.
  const room = H - titleH - u * 6 - u * 8;
  const wordsH = u * 8 + nameH + u * 3 + whereH;
  const tileW = Math.min(W * 0.55, u * 50, (room - wordsH) / 1.05);
  const tileH = tileW * 1.05;
  const blockH = tileH + wordsH;
  const y = titleH + u * 4 + Math.max(0, (room - blockH) / 2);
  const nameY = y + tileH + u * 8;
  const centred = { textAlignX: 'center' } as const;
  return [
    { ...k.title(0, 0, W, titleH, 'Save the date'), ...centred },
    ...calendarTile(k, (W - tileW) / 2, y, tileW, tileH),
    { ...k.title(0, nameY, W, nameH, 'Summer Meetup'), ...centred },
    k.text(0, nameY + nameH + u * 3, W, whereH, where, { textSize: 'lg', ...centred }),
    k.text(0, H - u * 6, W, u * 6, more, centred),
  ];
}

export const buildAnnouncement = (b: LayoutBox) => announcement(kit(b));
export const buildDidYouKnow = (b: LayoutBox) => didYouKnow(kit(b));
export const buildSaveTheDate = (b: LayoutBox) => saveTheDate(kit(b));
