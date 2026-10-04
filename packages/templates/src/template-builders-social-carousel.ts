// Social Carousel template (kind `social-carousel`, docs/specs/007-editor/templates-by-mode.md
// "Illustrate templates"): five Square slides for a LinkedIn or Instagram carousel by a made-up
// team lead, Maya Okafor, on running better one-to-ones, that opens in Illustrate ready to export
// slide by slide.
//
//   1. The hook: a kicker pill, the promise set large over two lines in two colours, a lead and
//      a sticker, on the brand's violet-to-magenta gradient.
//   2-4. A tip each, on a pale lavender wash: the tip's number set huge, its glyph on a disc, the
//      tip, a line on why, and a "Try" card with something to do this week.
//   5. The call to action, back on the gradient: save, share and follow, each on its own card.
//
// Every slide wears the same chrome so the set reads as one brand: the avatar, name and handle
// along the top, the slide number ("2/5") on a pill, progress dots at the foot and, on all but
// the last, a "Swipe" cue with an arrow. The colours are the carousel's own and locked against
// the theme; the avatar is an empty image placeholder (imageId: null), so the template ships no
// bytes.
//
// Pure: () -> Element[], placed on the carousel's pages (socialCarouselPages) whatever centre is
// passed.

import type { Element, IllustratePage, PageBackground } from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { CARD_SHADOW, glyph, iconDisc, lockedFill, panel } from './template-page-design';
import { pageKits, templatePage } from './template-page-kit';

const VIOLET = '#7c3aed';
const DEEP = '#2e1065';
const LILAC = '#ddd6fe';
const YELLOW = '#fde047';
const PAPER = '#ffffff';
const MUTED = '#4c1d95';

const NAME = 'Maya Okafor';
const HANDLE = '@maya.leads';
const SLIDES = 5;

const TIPS = [
  {
    iconId: 'clipboard',
    tip: 'Let them set the agenda',
    why: 'It is their meeting. Ask them to bring the first topic, and you will hear what really matters to them.',
    tryThis: 'A shared note they can add to all week',
  },
  {
    iconId: 'message',
    tip: 'Ask, then wait',
    why: 'Count to five before you fill a silence. The most honest answers tend to come after the pause.',
    tryThis: '“What is one thing I could do better?”',
  },
  {
    iconId: 'check-circle',
    tip: 'End with one action each',
    why: 'Write them down together, then open next week by checking in on both of them.',
    tryThis: 'A running list at the top of your shared note',
  },
] as const;

const ACTIONS = [
  { iconId: 'bookmark', label: 'Save it for your next 1:1' },
  { iconId: 'share-2', label: 'Send it to a new manager' },
  { iconId: 'user-plus', label: `Follow ${HANDLE} for more` },
] as const;

const GRADIENT: PageBackground = {
  fill: { kind: 'gradient', from: '#5b21b6', to: '#be185d', angle: 135 },
};
const WASH: PageBackground = {
  fill: { kind: 'gradient', from: '#faf5ff', to: '#ede9fe', angle: 160 },
};

/** The carousel's pages: five Square slides, the hook and the close on the brand gradient. */
export function socialCarouselPages(): IllustratePage[] {
  return [
    templatePage(1, 'square', 'portrait', 'Hook', GRADIENT),
    ...TIPS.map((_, i) => templatePage(i + 2, 'square', 'portrait', `Tip ${i + 1}`, WASH)),
    templatePage(SLIDES, 'square', 'portrait', 'Follow', GRADIENT),
  ];
}

// The chrome every slide wears: avatar, name and handle, the slide number, the progress dots and,
// on all but the last, the swipe cue. `dark` is a slide on the gradient.
function chrome(k: Kit, n: number, dark: boolean): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const avatar = u * 9;
  const ink = dark ? PAPER : DEEP;
  const soft = dark ? LILAC : VIOLET;
  const dot = u * 1.8;
  const els: Element[] = [
    {
      ...k.image(0, 0, avatar, avatar),
      borderRadius: 'full',
      aspectLocked: true,
    },
    k.text(avatar + u * 2.5, u * 0.4, W * 0.5, u * 4.5, NAME, {
      textBold: true,
      textScale: 1.15,
      textColor: ink,
    }),
    k.text(avatar + u * 2.5, u * 4.8, W * 0.5, u * 4, HANDLE, { textColor: soft }),
    k.shape('stadium', W - u * 14, u * 1.5, u * 14, u * 6, {
      label: `${n}/${SLIDES}`,
      textBold: true,
      textColor: dark ? DEEP : PAPER,
      ...lockedFill(dark ? PAPER : VIOLET),
    }),
    ...Array.from({ length: SLIDES }, (_, i) =>
      k.shape('circle', i * (dot + u * 1.6), H - u * 3.5 - dot / 2, dot, dot, {
        label: '',
        ...lockedFill(i + 1 === n ? soft : dark ? '#a78bfa' : '#c4b5fd'),
      }),
    ),
  ];
  if (n < SLIDES) {
    const d = u * 7;
    els.push(
      k.text(W - d - u * 22, H - u * 3.5 - u * 2.5, u * 20, u * 5, 'Swipe', {
        textBold: true,
        textScale: 1.2,
        textColor: ink,
        textAlignX: 'right',
        textAlignY: 'middle',
      }),
      ...iconDisc(
        k,
        'arrow-right',
        W - d,
        H - u * 3.5 - d / 2,
        d,
        dark ? PAPER : VIOLET,
        dark ? VIOLET : PAPER,
      ),
    );
  }
  return els;
}

// 1. The hook: the kicker pill, the promise, the lead and a sticker.
function hook(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  return [
    ...chrome(k, 1, true),
    k.shape('stadium', 0, u * 17, u * 34, u * 6, {
      label: 'FOR NEW MANAGERS',
      textBold: true,
      textColor: DEEP,
      ...lockedFill(YELLOW),
    }),
    { ...k.title(0, u * 26, W, u * 14, 'Three small habits'), textColor: PAPER },
    { ...k.title(0, u * 40, W, u * 14, 'for better 1:1s'), textColor: YELLOW },
    k.text(
      0,
      u * 57,
      W * 0.68,
      u * 22,
      'Five minutes of prep that turn a status update into the best half hour of your week.',
      { textScale: 1.6, textColor: LILAC },
    ),
    k.shape('sticker', W - u * 25, u * 59, u * 23, u * 23, {
      stickerId: 'emoji-speech-balloon',
      rotation: 10,
    }),
  ];
}

// 2-4. A tip: the number set huge, its glyph on a disc, the tip, why, and the "Try" card.
function tip(k: Kit, i: number): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const t = TIPS[i]!;
  const d = u * 17;
  const cardTop = u * 73;
  const cardH = u * 12;
  return [
    ...chrome(k, i + 2, false),
    { ...k.title(0, u * 13, W * 0.5, u * 26, `0${i + 1}`), textColor: VIOLET },
    ...iconDisc(k, t.iconId, W - d, u * 18, d, VIOLET, PAPER),
    k.text(0, u * 40, W, u * 9, t.tip, {
      textBold: true,
      textScale: 2.5,
      textColor: DEEP,
    }),
    k.text(0, u * 52, W * 0.94, u * 18, t.why, { textScale: 1.6, textColor: MUTED }),
    panel(k, 0, cardTop, W, cardH, PAPER, { strokeColor: LILAC, shadow: CARD_SHADOW }),
    glyph(k, 'zap', u * 4, cardTop + (cardH - u * 5) / 2, u * 5, '#db2777'),
    k.text(u * 12, cardTop + (cardH - u * 6) / 2, W - u * 16, u * 6, `Try: ${t.tryThis}`, {
      textBold: true,
      textScale: 1.2,
      textColor: DEEP,
      textAlignY: 'middle',
    }),
  ];
}

// 5. The call to action: the ask, the reason, and save, share and follow on cards.
function close(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const rowH = u * 11;
  const d = u * 7;
  return [
    ...chrome(k, SLIDES, true),
    { ...k.title(0, u * 15, W, u * 14, 'Found this useful?'), textColor: PAPER },
    k.text(0, u * 31, W * 0.9, u * 12, 'One tip on leading teams, every Tuesday.', {
      textScale: 1.6,
      textColor: LILAC,
    }),
    ...ACTIONS.flatMap((a, i) => {
      const y = u * (46 + i * 14);
      return [
        panel(k, 0, y, W * 0.86, rowH, PAPER, { shadow: CARD_SHADOW }),
        ...iconDisc(k, a.iconId, u * 3, y + (rowH - d) / 2, d, i === 2 ? '#db2777' : VIOLET, PAPER),
        k.text(u * 14, y + (rowH - u * 6) / 2, W * 0.86 - u * 17, u * 6, a.label, {
          textBold: true,
          textScale: 1.3,
          textColor: DEEP,
          textAlignY: 'middle',
        }),
      ];
    }),
    k.shape('sticker', W - u * 17, u * 74, u * 17, u * 17, {
      stickerId: 'emoji-sparkles',
      rotation: -10,
    }),
  ];
}

export function buildSocialCarousel(): Element[] {
  const kits = pageKits(socialCarouselPages());
  return [
    ...hook(kits[0]!),
    ...TIPS.flatMap((_, i) => tip(kits[i + 1]!, i)),
    ...close(kits[SLIDES - 1]!),
  ];
}
