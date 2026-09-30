// The mobile wireframe, plus the barrel for its device siblings: the laptop
// dashboard (./template-builders-laptop) and the web page
// (./template-builders-browser) grew into their own files, and all three
// share the UI factory and annotation grammar in ./template-wireframe-kit.
//
// Pure: (cx, cy) -> Element[]. See docs/specs/008-canvas/canvas-and-palette.md "Templates".

import { createPinnedArrow, createShape, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';
import {
  WIREFRAME_HEADING_H,
  WIREFRAME_MUTED,
  annotationPin,
  annotationRail,
  annotationRailHeight,
  textAt,
  uiAt,
  wireframeHeading,
} from './template-wireframe-kit';
export { buildLaptopWireframe } from './template-builders-laptop';
export { buildBrowserWireframe } from './template-builders-browser';

// Mobile wireframe: one happy path through an order-ahead coffee app, told
// as a user flow rather than three unrelated screens. Menu -> Customise ->
// Order placed, each a real screen with believable copy (a pickup chip, a
// priced menu, a size selector and an extras checklist, a live status), and
// a "Tap" arrow from the control that moves you on to the next phone.
// Five numbered pins sit on the decisions worth explaining and match five
// amber notes in a rail on the right, the way a design hand-off reads.
// Phones are the "Frames" scaffold; everything on or beside them is "UI".
// Colours stay theme-owned; only the notes (paper amber) and the one
// selected size (soft) set their own.
const MOBILE_NOTES = [
  'Pickup shop and wait time come first: they decide whether people order at all.',
  'Tapping a drink opens Customise, so nothing lands in the basket by accident.',
  'Regular is preselected, and the price updates as options change.',
  'The button always shows the running total, extras included.',
  'Status moves by push notification; no pull-to-refresh needed.',
];

export function buildMobileWireframe(cx: number, cy: number): Element[] {
  const phoneW = 304;
  const phoneH = 686;
  const gap = 120;
  const railGap = 64;
  const railW = 300;
  const noteH = 72;
  const totalW = 3 * phoneW + 2 * gap + railGap + railW;
  const totalH = WIREFRAME_HEADING_H + phoneH;
  const x0 = cx - totalW / 2;
  const y0 = cy - totalH / 2;
  const phoneY = y0 + WIREFRAME_HEADING_H;
  const phoneX = (i: number) => x0 + i * (phoneW + gap);

  const elements: Element[] = wireframeHeading(
    x0,
    y0,
    totalW,
    'Order-ahead coffee · mobile flow',
    'Three screens of one happy path. Arrows are taps; numbered pins match the notes on the right.',
  );

  const phones = (['1 · Menu', '2 · Customise', '3 · Order placed'] as const).map((label, i) => ({
    ...createShape('phone', phoneX(i), phoneY),
    width: phoneW,
    height: phoneH,
    label,
    textSize: 'sm' as const,
    textAlignY: 'top' as const,
    // Pushes the screen name clear of the bezel's top edge.
    padding: 'lg' as const,
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  }));
  elements.push(...phones);

  // Screen content spans x 26..278 and y 76..608 of each phone (the phone
  // shape's display inset); offsets below are phone-local.
  const muted = { textColor: WIREFRAME_MUTED };
  const bold = { textBold: true };
  const screen = (i: number) => {
    const ui = uiAt(phoneX(i), phoneY);
    const text = textAt(phoneX(i), phoneY);
    // Status bar: clock left, radios right.
    elements.push(text(30, 74, 60, 22, '9:41', bold));
    elements.push(ui('icon', 232, 77, 16, 16, { iconId: 'wifi' }));
    elements.push(ui('icon', 256, 77, 16, 16, { iconId: 'battery' }));
    return { ui, text };
  };
  const tabBar = (i: number) => {
    const ui = uiAt(phoneX(i), phoneY);
    elements.push(ui('square', 26, 556, 252, 52, { borderRadius: 'md', strokeWidth: 'thin' }));
    ['home', 'clipboard', 'user'].forEach((iconId, t) => {
      elements.push(ui('icon', 56 + t * 84, 570, 24, 24, { iconId }));
    });
  };
  // Ids of the two controls the tap arrows leave from (the first menu item's
  // card, the Customise CTA), set as those screens are drawn.
  const tapFrom: string[] = [];
  const pinAt = (i: number, n: number, rx: number, ry: number) =>
    elements.push(annotationPin(n, phoneX(i) + rx, phoneY + ry));

  // 1 · Menu: greeting, pickup chip, search, and a priced "Popular" list.
  {
    const { ui, text } = screen(0);
    elements.push(text(30, 104, 244, 36, 'Morning, Jo', { textSize: 'lg', ...bold }));
    elements.push(
      ui('stadium', 26, 146, 252, 36, {
        label: 'King’s Cross · ready in 6 min',
        textSize: 'sm',
        colorPreset: 'soft',
      }),
    );
    elements.push(
      ui('stadium', 26, 194, 252, 36, {
        label: 'Search drinks and food…',
        textSize: 'sm',
        textAlignX: 'left',
        strokeWidth: 'thin',
      }),
    );
    elements.push(text(30, 244, 200, 28, 'Popular', { textSize: 'md', ...bold }));
    const items: [string, string, string][] = [
      ['Oat flat white', 'Double shot, oat milk', '£3.40'],
      ['Iced latte', 'Cold milk over ice', '£3.60'],
      ['Cinnamon bun', 'Baked this morning', '£2.90'],
    ];
    items.forEach(([name, blurb, price], r) => {
      const y = 280 + r * 76;
      const card = ui('square', 26, y, 252, 64, { borderRadius: 'md', strokeWidth: 'thin' });
      elements.push(card);
      if (r === 0) tapFrom.push(card.id);
      elements.push(ui('circle', 38, y + 12, 40, 40));
      elements.push(text(90, y + 10, 124, 22, name, bold));
      elements.push(text(90, y + 32, 176, 20, blurb, muted));
      elements.push(text(214, y + 10, 54, 22, price, { ...bold, textAlignX: 'right' }));
    });
    tabBar(0);
    pinAt(0, 1, 278, 146);
    pinAt(0, 2, 278, 280);
  }

  // 2 · Customise: a modal step, so no tab bar; the CTA owns the foot.
  {
    const { ui, text } = screen(1);
    elements.push(ui('icon', 26, 108, 24, 24, { iconId: 'arrow-left' }));
    elements.push(text(58, 104, 220, 32, 'Oat flat white', { textSize: 'lg', ...bold }));
    elements.push(ui('square', 26, 146, 252, 110, { borderRadius: 'md', strokeWidth: 'thin' }));
    elements.push(ui('icon', 132, 181, 40, 40, { iconId: 'image' }));
    elements.push(text(30, 268, 120, 24, 'Size', bold));
    ['Small', 'Regular', 'Large'].forEach((label, s) => {
      elements.push(
        ui('stadium', 26 + s * 87, 296, 78, 34, {
          label,
          textSize: 'sm',
          ...(s === 1 ? { colorPreset: 'soft', textBold: true } : { strokeWidth: 'thin' }),
        }),
      );
    });
    elements.push(text(30, 344, 120, 24, 'Extras', bold));
    elements.push(
      ui('checklist', 26, 372, 252, 120, {
        checklistItems: [
          { text: 'Extra shot · +50p', done: false },
          { text: 'Vanilla syrup · +40p', done: false },
          { text: 'Make it decaf', done: false },
        ],
      }),
    );
    const cta = ui('stadium', 26, 548, 252, 52, {
      label: 'Add to order · £3.40',
      textSize: 'sm',
      textBold: true,
      colorPreset: 'bold',
    });
    elements.push(cta);
    tapFrom.push(cta.id);
    pinAt(1, 3, 191, 296);
    pinAt(1, 4, 278, 548);
  }

  // 3 · Order placed: the payoff, then what happens next.
  {
    const { ui, text } = screen(2);
    elements.push(ui('sticker', 108, 108, 88, 88, { stickerId: 'emoji-coffee' }));
    elements.push(
      text(26, 208, 252, 36, 'Order placed!', { textSize: 'lg', ...bold, textAlignX: 'center' }),
    );
    elements.push(
      text(26, 244, 252, 24, 'Ready at 08:52 · King’s Cross', {
        ...muted,
        textAlignX: 'center',
      }),
    );
    elements.push(
      ui('process', 26, 284, 252, 84, {
        processSteps: ['Placed', 'Brewing', 'Ready'],
        textSize: 'sm',
      }),
    );
    elements.push(ui('square', 26, 386, 252, 92, { borderRadius: 'md', strokeWidth: 'thin' }));
    elements.push(text(40, 398, 170, 22, '1 × Oat flat white', bold));
    elements.push(text(40, 420, 170, 20, 'Regular · oat milk', muted));
    elements.push(text(40, 444, 170, 20, 'Paid with Apple Pay', muted));
    elements.push(text(206, 398, 60, 22, '£3.40', { ...bold, textAlignX: 'right' }));
    elements.push(
      ui('stadium', 26, 494, 252, 44, {
        label: 'Directions to the shop',
        textSize: 'sm',
        colorPreset: 'outline',
      }),
    );
    tabBar(2);
    pinAt(2, 5, 278, 284);
  }

  // The taps that move the flow on: the first menu item opens Customise,
  // and "Add to order" places it. Pinned both ends, so moving either the
  // control or the next phone keeps the arrow attached.
  elements.push(
    {
      ...createPinnedArrow(tapFrom[0]!, 'e', phones[1]!.id, 'w'),
      label: 'Tap',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    },
    {
      ...createPinnedArrow(tapFrom[1]!, 'e', phones[2]!.id, 'w'),
      label: 'Tap',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    },
  );

  const railH = annotationRailHeight(noteH, MOBILE_NOTES.length);
  elements.push(
    ...annotationRail(
      x0 + 3 * phoneW + 2 * gap + railGap,
      phoneY + (phoneH - railH) / 2,
      railW,
      noteH,
      MOBILE_NOTES,
    ),
  );

  return elements;
}
