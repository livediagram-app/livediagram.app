// The retro formats a team rotates through (docs/specs/008-canvas/canvas-and-palette.md "Templates"):
// Start / Stop / Continue lives here; Mad / Sad / Glad, the 4Ls and the
// Sailboat have their own modules and are re-exported below. All of them are
// built from the shared retro kit (template-retro-kit.ts), so the ritual is
// the same every time (mood check, timer, vote, owned actions) while each
// format keeps its own personality.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createShape, createText, type Element } from '@livediagram/document';
import {
  actionChecklist,
  actionsColumn,
  checklistHeight,
  panelHeading,
  RETRO,
  RETRO_HUES,
  RETRO_MUTED,
  retroColumnHeight,
  retroHeading,
  retroNotesTop,
  retroPanel,
  retroRail,
  SCAFFOLD,
  stickyStack,
  type RetroHue,
} from './template-retro-kit';

export { buildFourLs } from './template-builders-four-ls';
export { buildMadSadGlad } from './template-builders-mad-sad-glad';
export { buildSailboat } from './template-builders-sailboat';

// --- Start, Stop, Continue -----------------------------------------------

// A traffic light turned into verbs. Each column leads with a solid "lamp"
// in its hue carrying a media-control glyph (play, stop, repeat), so the
// three read as go / halt / keep going before a word is read.
type Lamp = 'play' | 'stop' | 'repeat';

const SSC_COLUMNS: {
  label: string;
  hint: string;
  lamp: Lamp;
  lampFill: string;
  hue: RetroHue;
  notes: string[];
}[] = [
  {
    label: 'Start',
    hint: 'What should we begin doing?',
    lamp: 'play',
    lampFill: '#16a34a',
    hue: RETRO_HUES.green,
    notes: [
      'Write the release notes as we merge',
      'Pair on every on-call handover',
      'Demo work in progress on Thursdays',
    ],
  },
  {
    label: 'Stop',
    hint: 'What’s getting in our way?',
    lamp: 'stop',
    lampFill: '#e11d48',
    hue: RETRO_HUES.rose,
    notes: [
      'Picking up new tickets while reviews wait',
      'Merging after 3pm on a Friday',
      'Taking scope changes over DMs',
    ],
  },
  {
    label: 'Continue',
    hint: 'What’s working that we keep?',
    lamp: 'repeat',
    lampFill: '#0284c7',
    hue: RETRO_HUES.sky,
    notes: [
      'Ten-minute bug triage after standup',
      'A design and dev kickoff for every epic',
      'Posting shipped work in #wins',
    ],
  },
];

const SSC_ACTIONS = [
  'Release notes in PR template · Priya · Tue',
  'No merges after 3pm Friday · Tom · Fri',
  'Scope asks go through the board · Jo · Mon',
];

// Last sprint's actions, checked in before this one's are written: two done,
// one carried over, so the format keeps its promises visible.
const SSC_LAST_ACTIONS = [
  'Quarantine the flaky login test · Sam · Wed',
  'Timebox standup to 15 min · Leo · Mon',
  'Automate the deploy approval · Ana · Fri',
];

const LAMP = 48;

// The lamp: a solid disc in the column's hue with a white glyph on it. Fills
// are theme-locked so the traffic light survives any theme.
function lamp(x: number, y: number, kind: Lamp, fill: string): Element[] {
  const disc: Element = {
    ...createShape('circle', x, y),
    width: LAMP,
    height: LAMP,
    fillColor: fill,
    strokeColor: fill,
    themeLockFill: true,
    ...SCAFFOLD,
  };
  const c = LAMP / 2;
  if (kind === 'play') {
    // A triangle turned to point right, nudged right of centre so it sits
    // optically centred in the disc the way a play button does.
    const s = 20;
    return [
      disc,
      {
        ...createShape('triangle', x + c - s / 2 + 2, y + c - s / 2),
        width: s,
        height: s,
        rotation: 90,
        fillColor: '#ffffff',
        strokeColor: '#ffffff',
        strokeWidth: 'thin',
        themeLockFill: true,
        ...SCAFFOLD,
      },
    ];
  }
  if (kind === 'stop') {
    const s = 17;
    return [
      disc,
      {
        ...createShape('square', x + c - s / 2, y + c - s / 2),
        width: s,
        height: s,
        fillColor: '#ffffff',
        strokeColor: '#ffffff',
        borderRadius: 'sm',
        themeLockFill: true,
        ...SCAFFOLD,
      },
    ];
  }
  const s = 26;
  return [
    disc,
    {
      ...createShape('icon', x + c - s / 2, y + c - s / 2),
      width: s,
      height: s,
      iconId: 'refresh-cw',
      strokeColor: '#ffffff',
      ...SCAFFOLD,
    },
  ];
}

export function buildStartStopContinue(cx: number, cy: number): Element[] {
  const { colW, railW, gap, pad, headerH, titleH, subtitleH, headGap, stickyH } = RETRO;
  const colH = retroColumnHeight(3);
  const totalW = railW + (colW + gap) * 4;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + subtitleH + headGap + colH) / 2;
  const top = y0 + titleH + subtitleH + headGap;
  const notesTop = retroNotesTop(top);

  const elements: Element[] = [
    ...retroHeading(
      x0,
      y0,
      totalW,
      'Sprint 22 · Start, Stop, Continue',
      'Check the temperature, write for 5 minutes, dot-vote the top three, then give each one an owner and a day.',
    ),
    ...retroRail(x0, top, colH, {
      question: 'How did Sprint 22 feel?',
      minutes: 5,
      dots: 3,
      note: 'Write one idea per note, then read them out column by column. Spend your three dots on the notes worth acting on.',
    }),
  ];

  SSC_COLUMNS.forEach((col, i) => {
    const x = x0 + railW + gap + i * (colW + gap);
    const labelX = x + pad + LAMP + 14;
    elements.push(
      retroPanel(x, top, colW, colH, col.hue),
      ...lamp(x + pad, top + pad, col.lamp, col.lampFill),
      {
        ...createText(labelX, top + pad),
        width: x + colW - pad - labelX,
        height: headerH,
        label: col.label,
        textSize: 'lg',
        textBold: true,
        textAlignX: 'left',
        textColor: col.hue.headerColor,
        ...SCAFFOLD,
      },
      {
        ...createText(x + pad, top + pad + headerH),
        width: colW - pad * 2,
        height: RETRO.hintH,
        label: col.hint,
        textSize: 'sm',
        textColor: RETRO_MUTED,
        textAlignX: 'left',
        ...SCAFFOLD,
      },
      ...stickyStack(x + pad, notesTop, colW - pad * 2, stickyH, col.notes, col.hue.sticky),
    );
  });

  // Action items, then last sprint's list checked in underneath it.
  const actionsX = x0 + railW + gap + 3 * (colW + gap);
  elements.push(
    ...actionsColumn(actionsX, top, colH, { hint: 'One owner and a day each', items: SSC_ACTIONS }),
  );
  const lastTop = notesTop + checklistHeight(SSC_ACTIONS.length) + 24;
  elements.push(
    panelHeading(actionsX + pad, lastTop, colW - pad * 2, 'From Sprint 21'),
    actionChecklist(actionsX + pad, lastTop + 40, colW - pad * 2, SSC_LAST_ACTIONS, [
      true,
      true,
      false,
    ]),
  );
  return elements;
}
