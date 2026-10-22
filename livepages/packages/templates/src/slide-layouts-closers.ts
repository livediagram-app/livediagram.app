// Slide closers (docs/specs/007-editor/pages-mode.md "Slide layouts", Closers): the slides a
// talk ends on, besides Thank You and Team. Pure builders on the slide kit, in units of the
// slide's height.
import type { Element } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import {
  eyebrow,
  iconDisc,
  numberDisc,
  over,
  rule,
  slideHeading,
  slideType,
} from './slide-layout-kit';

const CENTRE = { textAlignX: 'center' } as const;

/** In summary: three numbered takeaways, each a bold line and a note. */
export function summarySlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'In summary');
  const points = [
    ['Start small', 'One team, one quarter, one number to move.'],
    ['Learn in public', 'Share what worked and what did not, every week.'],
    ['Scale what works', 'Only then roll it out to everyone.'],
  ] as const;
  const rowH = (H - head.top) / points.length;
  const d = Math.min(u * 14, rowH * 0.7);
  const x = d + u * 6;
  return [
    ...head.els,
    ...points.flatMap(([name, note], i) => {
      const y = head.top + i * rowH;
      return [
        ...numberDisc(k, 0, y + (rowH - d) / 2, d, String(i + 1)),
        k.text(x, y + (rowH - d) / 2, W - x, d * 0.55, name, {
          ...slideType(k, 5),
          textBold: true,
          textAlignY: 'bottom',
        }),
        k.text(x, y + (rowH - d) / 2 + d * 0.58, W - x, d * 0.5, note, slideType(k, 3.6)),
      ];
    }),
  ];
}

/** The ask: one bold line, centred, a button-like pill under it and where to find out more. */
export function callToActionSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const w = W * 0.84;
  const x = (W - w) / 2;
  const top = H * 0.2;
  const pillW = Math.min(W * 0.42, u * 62);
  return [
    { ...eyebrow(k, x, top, w, 'ONE THING TO DO TODAY'), ...CENTRE },
    k.text(x, top + u * 8, w, u * 30, 'Pick one meeting this week and make it a working session.', {
      ...slideType(k, 7),
      textBold: true,
      ...CENTRE,
      textAlignY: 'middle',
    }),
    k.shape('stadium', (W - pillW) / 2, top + u * 44, pillW, u * 13, { label: '' }),
    over(k, (W - pillW) / 2, top + u * 44, pillW, u * 13, 'Start your first board', 4),
    k.text(x, H - u * 7, w, u * 7, 'example.com/start', {
      ...slideType(k, 3.4),
      ...CENTRE,
      textAlignY: 'bottom',
    }),
  ];
}

/** Next steps: four actions, each with who owns it and by when, ticked off as they land. */
export function nextStepsSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'Next steps');
  const steps = [
    ['Share the proposal with the board', 'Alex', '18 Oct'],
    ['Pick the pilot team', 'Sam', '25 Oct'],
    ['Agree the one number we track', 'Priya', '1 Nov'],
    ['Review the first two weeks', 'Everyone', '15 Nov'],
  ] as const;
  const rowH = (H - head.top) / steps.length;
  const icon = Math.min(u * 8, rowH * 0.6);
  const whoW = W * 0.18;
  const whenW = W * 0.14;
  const actionX = icon + u * 4;
  const actionW = W - actionX - whoW - whenW - u * 4;
  return [
    ...head.els,
    ...steps.flatMap(([action, who, when], i) => {
      const y = head.top + i * rowH;
      const mid = { textAlignY: 'middle' as const };
      return [
        k.shape('icon', 0, y + (rowH - icon) / 2, icon, icon, { iconId: 'check-circle' }),
        k.text(actionX, y, actionW, rowH, action, { ...slideType(k, 4), ...mid }),
        k.text(actionX + actionW + u * 2, y, whoW, rowH, who, {
          ...slideType(k, 3.6),
          textBold: true,
          ...mid,
        }),
        k.text(W - whenW, y, whenW, rowH, when, {
          ...slideType(k, 3.6),
          textAlignX: 'right',
          ...mid,
        }),
        // A hairline under each row but the last.
        ...(i < steps.length - 1
          ? [k.shape('square', 0, y + rowH - u * 0.3, W, u * 0.3, { label: '' })]
          : []),
      ];
    }),
  ];
}

/** Stay in touch: a round photo, the name and role, and where to find them. */
export function contactSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const d = Math.min(W * 0.32, u * 56);
  const x = d + u * 10;
  const w = W - x;
  const rows = [
    ['mail', 'alex@example.com'],
    ['globe', 'example.com'],
    ['phone', '+44 20 7946 0000'],
  ] as const;
  const top = H * 0.14;
  const rowY = top + u * 36;
  const rowH = (H - rowY) / rows.length;
  const icon = Math.min(u * 7, rowH * 0.6);
  return [
    { ...k.image(0, (H - d) / 2, d, d), borderRadius: 'full' as const },
    eyebrow(k, x, top, w, 'STAY IN TOUCH'),
    k.title(x, top + u * 7, w, u * 13, 'Alex Morgan'),
    k.text(x, top + u * 21, w, u * 8, 'Head of Product, Example Co', slideType(k, 4)),
    rule(k, x, top + u * 31),
    ...rows.flatMap(([iconId, line], i) => {
      const y = rowY + i * rowH;
      return [
        k.shape('icon', x, y + (rowH - icon) / 2, icon, icon, { iconId }),
        k.text(x + icon + u * 4, y, w - icon - u * 4, rowH, line, {
          ...slideType(k, 4),
          textAlignY: 'middle',
        }),
      ];
    }),
  ];
}

/** Questions: an icon in a disc, the word set very large, and how to ask later. */
export function questionsSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const d = u * 20;
  const w = W * 0.8;
  const x = (W - w) / 2;
  return [
    ...iconDisc(k, (W - d) / 2, H * 0.14, d, 'help-circle'),
    { ...k.title(x, H * 0.14 + d + u * 6, w, u * 24, 'Questions?'), ...CENTRE },
    k.text(x, H * 0.14 + d + u * 34, w, u * 9, 'Or ask later: alex@example.com', {
      ...slideType(k, 4),
      ...CENTRE,
    }),
  ];
}

/** Thank you on the left, a picture filling the right. */
export function thanksImageSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const textW = W * 0.46;
  const top = H * 0.26;
  return [
    k.title(0, top, textW, u * 20, 'Thank you'),
    rule(k, 0, top + u * 23),
    k.text(0, top + u * 27, textW, u * 18, 'Slides and notes: example.com/talk', slideType(k, 4.2)),
    k.text(0, H - u * 6, textW, u * 6, '@alexmorgan · alex@example.com', {
      ...slideType(k, 3),
      textAlignY: 'bottom',
    }),
    k.image(W * 0.52, 0, W * 0.48, H),
  ];
}

/** Further reading: four resources, each an icon, a title and where to find it. */
export function resourcesSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'Further reading');
  const items = [
    ['book', 'The playbook', 'example.com/playbook'],
    ['file', 'This talk, with notes', 'example.com/talk'],
    ['link', 'The research behind it', 'example.com/research'],
    ['message', 'Join the community', 'example.com/community'],
  ] as const;
  const rowH = (H - head.top) / items.length;
  const d = Math.min(u * 13, rowH * 0.78);
  const x = d + u * 5;
  return [
    ...head.els,
    ...items.flatMap(([iconId, title, where], i) => {
      const y = head.top + i * rowH + (rowH - d) / 2;
      return [
        ...iconDisc(k, 0, y, d, iconId),
        k.text(x, y, W - x, d * 0.56, title, {
          ...slideType(k, 4.4),
          textBold: true,
          textAlignY: 'bottom',
        }),
        k.text(x, y + d * 0.58, W - x, d * 0.42, where, slideType(k, 3.2)),
      ];
    }),
  ];
}
