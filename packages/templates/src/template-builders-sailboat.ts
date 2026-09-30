// The Sailboat retrospective (docs/specs/008-canvas/canvas-and-palette.md "Templates"): the picture
// retro. A drawn scene carries the metaphor (template-sailboat-scene.ts) so
// nobody needs it explained: Wind blowing into the sails from the left (what
// pushes us forward), Anchors hanging on a rope under the hull (what holds us
// back), Rocks breaking the surface ahead (risks we can see coming) and an
// Island on the horizon (the goal we are sailing to). Each zone is a softly
// tinted card with a glyph, a prompt and notes in its hue, placed where the
// metaphor puts it. The shared opening rail sits to the left (with the
// voyage's running order as an agenda) and Action items close it on the right.
//
// Pure: takes a centre (cx, cy), returns a fresh Element[].

import { createArrow, createFreehand, createShape, type Element } from '@livediagram/document';
import {
  actionsColumn,
  checklistHeight,
  CONTENT,
  moodCheck,
  panelHeading,
  railNote,
  RETRO,
  RETRO_HUES,
  RETRO_MUTED,
  retroHeader,
  retroHeading,
  retroNotesTop,
  retroPanel,
  retroSticky,
  SCAFFOLD,
  sessionButtons,
  stickyStack,
  type RetroHue,
} from './template-retro-kit';
import {
  sceneBackdrop,
  sceneBoat,
  sceneIsland,
  sceneRocks,
  sceneSun,
  type SceneLayout,
} from './template-sailboat-scene';

type Zone = {
  label: string;
  hint: string;
  icon: string;
  hue: RetroHue;
  notes: string[];
  // Scene-local box.
  x: number;
  y: number;
  w: number;
  cols: number;
};

const SCENE: SceneLayout = {
  width: 1400,
  height: 880,
  waterline: 430,
  boatX: 660,
  rocksX: 880,
  islandX: 1180,
  sunX: 840,
};

const NOTE_H = 96;
const ZONE_TOP_BELOW = SCENE.waterline + 84;

const ZONES: Zone[] = [
  {
    label: 'Island',
    hint: 'Where are we sailing to?',
    icon: 'flag',
    hue: RETRO_HUES.amber,
    notes: ['Mobile app in the App Store by 1 March', '10k weekly active users by summer'],
    x: SCENE.width - 24 - 440,
    y: 24,
    w: 440,
    cols: 2,
  },
  {
    label: 'Wind',
    hint: 'What pushes us forward?',
    icon: 'cloud',
    hue: RETRO_HUES.teal,
    notes: [
      'Customers keep asking for it',
      'The design system is ready',
      'Two engineers joined in July',
      'Leadership backs the roadmap',
    ],
    x: 24,
    y: 24,
    w: 400,
    cols: 2,
  },
  {
    label: 'Anchors',
    hint: 'What holds us back?',
    icon: '',
    hue: RETRO_HUES.slate,
    notes: [
      'The legacy API needs rewriting first',
      'Manual QA on every release',
      'Too many projects in parallel',
      'On-call eats our Fridays',
    ],
    x: SCENE.boatX - 190,
    y: ZONE_TOP_BELOW,
    w: 400,
    cols: 2,
  },
  {
    label: 'Rocks',
    hint: 'What risks lie ahead?',
    icon: 'alert-triangle',
    hue: RETRO_HUES.rose,
    notes: [
      'App Store review could cost us a week',
      'The payments contract ends in January',
      'Only Mei knows the build pipeline',
      'Holiday code freeze from 18 December',
    ],
    x: SCENE.boatX + 236,
    y: ZONE_TOP_BELOW,
    w: SCENE.width - 24 - (SCENE.boatX + 236),
    cols: 2,
  },
];

const SAIL_ACTIONS = [
  'Automate release smoke tests · Ravi · Fri',
  'Pair on the build pipeline · Mei · Wed',
  'Book App Store review early · Jo · 1 Feb',
  'Pause one side project · Sam · Mon',
];

const VOYAGE = [
  { label: 'Check last voyage’s actions', minutes: 5 },
  { label: 'Name the island', minutes: 5 },
  { label: 'Wind', minutes: 8 },
  { label: 'Anchors', minutes: 8 },
  { label: 'Rocks', minutes: 8 },
  { label: 'Vote and act', minutes: 11 },
];

const zoneHeight = (z: Zone) => {
  const rows = Math.ceil(z.notes.length / z.cols);
  return retroNotesTop(0) + rows * NOTE_H + (rows - 1) * RETRO.stickyGap + RETRO.pad;
};

// A drawn anchor, the Anchors zone's glyph: ring, shank, stock and arms.
function anchorGlyph(x: number, y: number, size: number, color: string): Element[] {
  const u = size / 24;
  const line = (pts: [number, number][], straight = false): Element => ({
    ...createFreehand(
      pts.map(([px, py]) => ({ x: x + px * u, y: y + py * u })),
      false,
    ),
    strokeColor: color,
    strokeWidth: 'medium',
    ...(straight ? { straightEdges: true } : {}),
    ...SCAFFOLD,
  });
  return [
    {
      ...createShape('circle', x + 9.5 * u, y + 1 * u),
      width: 5 * u,
      height: 5 * u,
      fillColor: 'transparent',
      strokeColor: color,
      strokeWidth: 'medium',
      ...SCAFFOLD,
    },
    line(
      [
        [12, 6],
        [12, 22],
      ],
      true,
    ),
    line(
      [
        [7, 9.5],
        [17, 9.5],
      ],
      true,
    ),
    line([
      [3.5, 14],
      [5, 18],
      [8.5, 21],
      [12, 22],
      [15.5, 21],
      [19, 18],
      [20.5, 14],
    ]),
  ];
}

export function buildSailboat(cx: number, cy: number): Element[] {
  const { railW, colW, gap, pad, titleH, subtitleH, headGap, stickyGap, buttonH } = RETRO;
  const bodyH = SCENE.height;
  const totalW = railW + gap + SCENE.width + gap + colW;
  const x0 = cx - totalW / 2;
  const y0 = cy - (titleH + subtitleH + headGap + bodyH) / 2;
  const top = y0 + titleH + subtitleH + headGap;
  const sx = x0 + railW + gap;
  const sy = top;

  // Rail: the mood, the voyage's running order, the tools, then a note.
  const tempH = 300;
  const agendaY = top + tempH + 20;
  const agendaH = 300;
  const buttonsY = agendaY + agendaH + 20;
  const noteY = buttonsY + buttonH + 20;
  const elements: Element[] = [
    ...retroHeading(
      x0,
      y0,
      totalW,
      'Team Atlas · Sailboat retro',
      'Name the island first, then work round the boat: the wind, the anchors, the rocks. Vote on what to lift or steer round.',
    ),
    moodCheck(x0, top, railW, tempH, 'How’s the voyage feeling?'),
    {
      ...createShape('agenda', x0, agendaY),
      width: railW,
      height: agendaH,
      label: 'The voyage',
      agendaItems: VOYAGE.map((item) => ({ ...item })),
      ...CONTENT,
    },
    ...sessionButtons(x0, buttonsY, railW, { minutes: 8, dots: 3 }),
    railNote(
      x0,
      noteY,
      railW,
      top + bodyH - noteY,
      'Put each note where it belongs in the picture. Three dots each: spend them on anchors to lift and rocks to steer round.',
    ),
  ];

  // The scene, back to front: sky and sea, sun, island, rocks, boat.
  elements.push(
    ...sceneBackdrop(sx, sy, SCENE),
    ...sceneSun(sx, sy, SCENE),
    ...sceneIsland(sx, sy, SCENE),
    ...sceneRocks(sx, sy, SCENE),
    ...sceneBoat(sx, sy, SCENE),
  );

  // Wind: three gusts blowing from the Wind zone into the sails.
  const wind = ZONES.find((z) => z.label === 'Wind')!;
  const jibLeft = (y: number) =>
    SCENE.boatX - 10 - (120 * (y - 132)) / (SCENE.waterline - 50 - 132);
  [170, 240, 310].forEach((ly, i) => {
    const fromX = sx + wind.x + wind.w + 12;
    const toX = sx + jibLeft(ly) - 14;
    elements.push({
      ...createArrow(fromX, sy + ly, toX, sy + ly + 6),
      arrowStyle: 'curved',
      curveOffset: { dx: 0, dy: i % 2 === 0 ? -14 : 14 },
      strokeColor: RETRO_HUES.teal.headerColor,
      strokeWidth: 3,
      strokeStyle: 'dashed',
      arrowheadSize: 'medium',
      flow: 'dashes',
      routeBehind: false,
      ...SCAFFOLD,
    });
  });

  // The zones, each a soft tint over the picture with its notes in its hue.
  ZONES.forEach((z) => {
    const x = sx + z.x;
    const y = sy + z.y;
    const h = zoneHeight(z);
    const noteW = (z.w - pad * 2 - (z.cols - 1) * stickyGap) / z.cols;
    elements.push(
      retroPanel(x, y, z.w, h, z.hue, { opacity: 0.94, borderRadius: 'lg' }),
      ...retroHeader(x, y, z.w, z.label, z.hint, z.icon, z.hue.headerColor).filter(
        (el) => !(el.type === 'shape' && el.shape === 'icon' && !el.iconId),
      ),
    );
    z.notes.forEach((note, i) => {
      elements.push(
        retroSticky(
          x + pad + (i % z.cols) * (noteW + stickyGap),
          retroNotesTop(y) + Math.floor(i / z.cols) * (NOTE_H + stickyGap),
          noteW,
          NOTE_H,
          note,
          z.hue.sticky,
        ),
      );
    });
  });

  // Anchors: the drawn anchor is the zone's glyph, on a rope from the hull.
  const anchors = ZONES.find((z) => z.label === 'Anchors')!;
  const glyph = 44;
  const gx = sx + anchors.x + anchors.w - pad - glyph;
  const gy = sy + anchors.y + pad + 2;
  const ropeTop = { x: sx + SCENE.boatX + 90, y: sy + SCENE.waterline + 30 };
  elements.push(
    {
      ...createFreehand(
        [
          ropeTop,
          { x: (ropeTop.x + gx + glyph / 2) / 2 + 10, y: (ropeTop.y + gy) / 2 + 6 },
          { x: gx + glyph / 2, y: gy + 4 },
        ],
        false,
      ),
      strokeColor: RETRO_HUES.slate.headerColor,
      strokeWidth: 'medium',
      strokeStyle: 'dashed',
      ...SCAFFOLD,
    },
    ...anchorGlyph(gx, gy, glyph, RETRO_HUES.slate.headerColor),
  );

  // Action items close it on the right, then how far the island is.
  const actionsX = sx + SCENE.width + gap;
  const innerW = colW - pad * 2;
  elements.push(
    ...actionsColumn(actionsX, top, bodyH, {
      hint: 'Lift an anchor or steer round a rock',
      items: SAIL_ACTIONS,
    }),
  );
  const courseTop = retroNotesTop(top) + checklistHeight(SAIL_ACTIONS.length) + 24;
  elements.push(
    panelHeading(actionsX + pad, courseTop, innerW, 'How far to the island?'),
    {
      ...createShape('progress-bar', actionsX + pad, courseTop + 44),
      width: innerW,
      height: 32,
      progress: 45,
      // The sea's blue on a pale track, locked so it holds under any theme.
      fillColor: '#e0f2fe',
      strokeColor: '#0284c7',
      textColor: '#075985',
      themeLockFill: true,
      ...CONTENT,
    },
    {
      ...railNote(
        actionsX + pad,
        courseTop + 88,
        innerW,
        48,
        'Beta is live with 1,200 testers. The App Store is next.',
      ),
      textColor: RETRO_MUTED,
    },
  );
  const shoutTop = courseTop + 88 + 48 + 24;
  const shoutNoteTop = shoutTop + 44;
  elements.push(
    panelHeading(actionsX + pad, shoutTop, innerW, 'Shout-outs'),
    // Two thank-yous stacked, so the room reads it as a pile to add to.
    ...stickyStack(
      actionsX + pad,
      shoutNoteTop,
      innerW,
      (top + bodyH - pad - shoutNoteTop - stickyGap) / 2,
      [
        'Thanks Priya for steering us through the beta launch!',
        'Kudos Ravi for the calm 2am rollback on Tuesday.',
      ],
      { fill: '#fde68a', text: '#451a03' },
    ),
    {
      ...createShape('sticker', actionsX + colW - pad - 64 - 8, top + bodyH - pad - 64 - 8),
      width: 64,
      height: 64,
      stickerId: 'emoji-clap',
      ...CONTENT,
    },
  );
  return elements;
}
