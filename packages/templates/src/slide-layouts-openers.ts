// Slide openers (docs/specs/007-editor/illustrate-pages.md "Slide layouts", Openers): the slides a
// talk starts on, besides the Title Slide, the Section Header and the Agenda. Pure builders on the
// slide kit, in units of the slide's height, so a 16:9 and a 4:3 slide both fit.
import type { Element } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import {
  bullets,
  card,
  columns,
  eyebrow,
  numberDisc,
  rule,
  slideHeading,
  slideType,
} from './slide-layout-kit';

const CENTRE = { textAlignX: 'center' } as const;

/** A title and subtitle on the left, a picture filling the right. */
export function titleImageSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const textW = W * 0.48;
  const top = H * 0.2;
  return [
    eyebrow(k, 0, top, textW, 'ANNUAL KICK-OFF'),
    // Two lines at a large size rather than one fitted line: a long title stays big.
    k.text(0, top + u * 8, textW, u * 20, 'Building what comes next', {
      ...slideType(k, 8),
      textBold: true,
      textAlignY: 'middle',
    }),
    rule(k, 0, top + u * 31),
    k.text(
      0,
      top + u * 31,
      textW,
      u * 16,
      'Where we are, where we are going and how we get there',
      {
        ...slideType(k, 4.4),
      },
    ),
    k.text(0, H - u * 6, textW, u * 6, 'Presenter name · October 2026', {
      ...slideType(k, 3),
      textAlignY: 'bottom',
    }),
    k.image(W * 0.53, 0, W * 0.47, H),
  ];
}

/** Everything centred: an eyebrow, a large title, a rule, a subtitle and the event at the foot. */
export function keynoteSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const top = H * 0.24;
  const w = W * 0.86;
  const x = (W - w) / 2;
  return [
    { ...eyebrow(k, x, top, w, 'KEYNOTE'), ...CENTRE },
    { ...k.title(x, top + u * 8, w, u * 20, 'The next ten years'), ...CENTRE },
    rule(k, (W - u * 14) / 2, top + u * 32),
    k.text(x, top + u * 37, w, u * 10, 'What changes, what stays and what we do about it', {
      ...slideType(k, 4.6),
      ...CENTRE,
    }),
    k.text(x, H - u * 6, w, u * 6, 'Presenter name · Conference name · October 2026', {
      ...slideType(k, 3),
      ...CENTRE,
      textAlignY: 'bottom',
    }),
  ];
}

/** A question to open on: an eyebrow, the question set very large, and a line under it. */
export function openingQuestionSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const w = W * 0.82;
  return [
    eyebrow(k, 0, H * 0.16, w, 'BEFORE WE START'),
    k.text(0, H * 0.16 + u * 9, w, u * 46, 'What would you do with one more hour every day?', {
      ...slideType(k, 9),
      textBold: true,
      textAlignY: 'middle',
    }),
    rule(k, 0, H * 0.16 + u * 59),
    k.text(0, H * 0.16 + u * 64, w, u * 10, 'Hold on to your answer. We will come back to it.', {
      ...slideType(k, 4.4),
    }),
  ];
}

/** About the speaker: a round photo, the name and role, and three things worth knowing. */
export function speakerSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const d = Math.min(W * 0.34, u * 62);
  const photoY = (H - d) / 2;
  const x = d + u * 10;
  const w = W - x;
  return [
    { ...k.image(0, photoY, d, d), borderRadius: 'full' as const },
    eyebrow(k, x, H * 0.14, w, 'ABOUT ME'),
    k.title(x, H * 0.14 + u * 7, w, u * 13, 'Alex Morgan'),
    k.text(x, H * 0.14 + u * 21, w, u * 8, 'Head of Product, Example Co', slideType(k, 4.2)),
    rule(k, x, H * 0.14 + u * 31),
    ...bullets(k, x, H * 0.14 + u * 36, w, H * 0.86 - u * 36, [
      'Twelve years building tools people love',
      'Led the team behind our biggest launch',
      'Ask me about running and sourdough',
    ]),
  ];
}

/** What the room will leave with: three numbered cards side by side. */
export function objectivesSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'By the end of this talk', 'Three things you will be able to do.');
  const items = [
    ['Spot the problem', 'Recognise the signs early, before they cost you.'],
    ['Size the fix', 'Weigh what it takes against what it saves.'],
    ['Make the case', 'Bring the room with you, with numbers.'],
  ] as const;
  const pad = u * 5;
  const cardH = H - head.top;
  const d = u * 13;
  return [
    ...head.els,
    ...columns(W, items.length, u * 5).flatMap(({ at, size }, i) => {
      const [name, note] = items[i]!;
      return [
        card(k, at, head.top, size, cardH),
        ...numberDisc(k, at + pad, head.top + pad, d, String(i + 1)),
        // Room for the name to take two lines on a 4:3 slide's narrower cards.
        k.text(at + pad, head.top + pad + d + u * 4, size - 2 * pad, u * 12, name, {
          ...slideType(k, 4.4),
          textBold: true,
        }),
        k.text(
          at + pad,
          head.top + pad + d + u * 18,
          size - 2 * pad,
          cardH - 2 * pad - d - u * 18,
          note,
          slideType(k, 3.6),
        ),
      ];
    }),
  ];
}

/** Today's agenda as four cards, two by two: a large number, the part and its time. */
export function agendaGridSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'Today');
  const items = [
    ['Where we are', '10 min'],
    ['What we learned', '15 min'],
    ['What we propose', '20 min'],
    ['Questions', '10 min'],
  ] as const;
  const gap = u * 4;
  const rows = columns(H - head.top, 2, gap);
  const cols = columns(W, 2, gap);
  const pad = u * 5;
  return [
    ...head.els,
    ...items.flatMap(([name, time], i) => {
      const c = cols[i % 2]!;
      const r = rows[Math.floor(i / 2)]!;
      const y = head.top + r.at;
      const numW = u * 18;
      return [
        card(k, c.at, y, c.size, r.size),
        k.title(c.at + pad, y + (r.size - u * 16) / 2, numW, u * 16, `0${i + 1}`),
        k.text(
          c.at + pad + numW + u * 3,
          y + r.size / 2 - u * 11,
          c.size - 2 * pad - numW - u * 3,
          u * 11,
          name,
          {
            ...slideType(k, 4.2),
            textBold: true,
            textAlignY: 'bottom',
          },
        ),
        k.text(
          c.at + pad + numW + u * 3,
          y + r.size / 2 + u * 1,
          c.size - 2 * pad - numW - u * 3,
          u * 6,
          time,
          {
            ...slideType(k, 3.4),
          },
        ),
      ];
    }),
  ];
}
