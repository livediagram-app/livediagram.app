// How It Works template (kind `how-it-works`, docs/specs/007-editor/templates-by-mode.md
// "Illustrate templates"): one Story (9:16) portrait page explaining a made-up neighbourhood
// lending app, Borrowbox, in five steps from first tap to done, sized for a story or a phone
// screen. It reads top to bottom:
//
//   - a kicker and the promise set large over two lines, then a one-line lead;
//   - five steps down a winding path: a glyph on a coloured disc for each, its number on a badge,
//     the step's name and a line about it beside the disc, the discs swapping sides as the path
//     swings back and forth between them;
//   - a call to action on a dark card at the foot, with a button and a party popper.
//
// The colours are the explainer's own (navy ink, one bright colour per step, on a warm wash) and
// locked against the theme. The path is real arrows pinned disc to disc, so moving a step drags
// its bends with it.
//
// Pure: () -> Element[], placed on the explainer's page (howItWorksPages) whatever centre is
// passed.

import {
  createPinnedArrow,
  type Element,
  type IllustratePage,
  type ShapeElement,
} from '@livediagram/document';
import type { Kit } from './page-layout-kit';
import { CARD_SHADOW, glyph, lockedFill, panel } from './template-page-design';
import { pageKits, templatePage } from './template-page-kit';

const NAVY = '#1e1b4b';
const MUTED = '#475569';
const PAPER = '#ffffff';
const CORAL = '#f43f5e';
const PATH = '#a5b4fc';

const STEPS = [
  {
    iconId: 'smartphone',
    color: '#0ea5e9',
    name: 'Get the app',
    note: 'Sign up with your phone number. It takes about a minute.',
  },
  {
    iconId: 'search',
    color: '#8b5cf6',
    name: 'Find what you need',
    note: 'Drills, ladders, tents: see what your neighbours lend nearby.',
  },
  {
    iconId: 'send',
    color: CORAL,
    name: 'Ask to borrow',
    note: 'Pick your dates and send a note. Most people reply within the hour.',
  },
  {
    iconId: 'map-pin',
    color: '#f59e0b',
    name: 'Pick it up',
    note: 'Meet at their door and scan their code to start the loan.',
  },
  {
    iconId: 'heart',
    color: '#10b981',
    name: 'Return and say thanks',
    note: 'Bring it back, leave a rating and earn credit for next time.',
  },
] as const;

const EXPLAINER_PAGE = templatePage(1, 'wide', 'portrait', 'How It Works', {
  fill: { kind: 'gradient', from: '#fff7ed', to: '#eef2ff', angle: 180 },
});

/** The explainer's page: one Story (9:16) portrait page on a warm-to-lavender wash. */
export function howItWorksPages(): IllustratePage[] {
  return [EXPLAINER_PAGE];
}

// The steps' band and rhythm, in units of the content box (190 units tall): where the first
// step starts, how tall a step is and the gap the path swings through between two steps.
const STEPS_TOP = 45;
const STEP_H = 18;
const STEP_GAP = 8.5;
const DISC = 16;
const CTA_H = 17;

// The kicker, the promise over two lines and the lead.
function masthead(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  return [
    k.text(0, 0, W, u * 5, 'BORROWBOX · HOW IT WORKS', {
      textBold: true,
      textScale: 1.4,
      textColor: CORAL,
    }),
    { ...k.title(0, u * 6, W, u * 13, 'Borrow it,'), textColor: NAVY },
    { ...k.title(0, u * 18, W, u * 13, "don't buy it"), textColor: '#6366f1' },
    k.text(0, u * 33, W * 0.95, u * 9, "From your neighbour's shed to your shelf in five steps.", {
      textScale: 1.6,
      textColor: MUTED,
    }),
  ];
}

// The five steps, the discs swapping sides, and the path between them.
function steps(k: Kit): Element[] {
  const { width: W } = k.box;
  const { u } = k;
  const d = u * DISC;
  const textW = W - d - u * 7;
  const els: Element[] = [];
  const discs: ShapeElement[] = [];
  STEPS.forEach((s, i) => {
    const y = u * (STEPS_TOP + i * (STEP_H + STEP_GAP));
    const left = i % 2 === 0;
    const discX = left ? u * 1 : W - d - u * 1;
    const textX = left ? d + u * 6 : 0;
    const disc = k.shape('circle', discX, y + u * 1, d, d, {
      label: '',
      shadow: CARD_SHADOW,
      ...lockedFill(s.color),
    });
    const badge = u * 6.5;
    discs.push(disc);
    els.push(
      disc,
      glyph(k, s.iconId, discX + d * 0.27, y + u * 1 + d * 0.27, d * 0.46, PAPER),
      k.shape('circle', discX + d - badge * 0.8, y - u * 0.5, badge, badge, {
        label: String(i + 1),
        textBold: true,
        textSize: 'lg',
        textColor: PAPER,
        strokeWidth: 'thick',
        ...lockedFill(NAVY, PAPER),
      }),
      k.text(textX, y + u * 1.5, textW, u * 6, s.name, {
        textBold: true,
        textScale: 2,
        textColor: NAVY,
        textAlignX: left ? 'left' : 'right',
      }),
      k.text(textX, y + u * 8, textW, u * 10, s.note, {
        textScale: 1.5,
        textColor: MUTED,
        textAlignX: left ? 'left' : 'right',
      }),
    );
  });
  // The path: an S-bend from the foot of each disc to the head of the next, swinging across the
  // gap between the two steps, dashed like a trail on a map.
  for (let i = 1; i < discs.length; i += 1) {
    const swing = (W / 2 - d) * (i % 2 === 1 ? 1 : -1);
    els.push({
      ...createPinnedArrow(discs[i - 1]!.id, 's', discs[i]!.id, 'n'),
      arrowStyle: 'curved',
      curvePoints: [
        { dx: -swing * 0.55, dy: u * 1.5 },
        { dx: swing * 0.55, dy: -u * 1.5 },
      ],
      strokeColor: PATH,
      strokeWidth: 6,
      strokeStyle: 'dashed',
      arrowheadSize: 'medium',
      exactStart: true,
      exactEnd: true,
    });
  }
  return els;
}

// The call to action: a dark card with the offer, the stores, a button and a party popper.
function callToAction(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const top = H - u * CTA_H;
  const pad = u * 6;
  const btnW = u * 30;
  return [
    panel(k, 0, top, W, u * CTA_H, NAVY, { shadow: CARD_SHADOW }),
    k.text(pad, top + u * 3, W - pad * 2 - btnW, u * 6, 'Your first loan is on us', {
      textBold: true,
      textScale: 1.8,
      textColor: PAPER,
    }),
    k.text(
      pad,
      top + u * 9.5,
      W - pad * 2 - btnW,
      u * 5,
      'Free on iOS and Android · borrowbox.app',
      {
        textScale: 1.2,
        textColor: '#c7d2fe',
      },
    ),
    k.shape('stadium', W - pad - btnW, top + (u * CTA_H - u * 8) / 2, btnW, u * 8, {
      label: 'Get the app',
      textBold: true,
      textSize: 'lg',
      textColor: PAPER,
      ...lockedFill(CORAL),
    }),
    k.shape('sticker', W - u * 13, top - u * 9, u * 14, u * 14, {
      stickerId: 'emoji-party-popper',
      rotation: 10,
    }),
  ];
}

export function buildHowItWorks(): Element[] {
  const [k] = pageKits(howItWorksPages());
  return [...masthead(k!), ...steps(k!), ...callToAction(k!)];
}
