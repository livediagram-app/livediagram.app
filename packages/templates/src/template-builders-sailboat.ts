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
  SCAFFOLD,
  sessionButtons,
  stickyGrid,
  stickyGridHeight,
  stickyStack,
  type RetroHue,
} from './template-retro-kit';
import {
  jibEdgeX,
  sceneBoat,
  sceneIsland,
  sceneRocks,
  sceneSea,
  sceneSky,
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

// Wind stands tall on the left of the sky (two notes abreast), the Island
// runs wide across the top right, and Anchors and Rocks sit side by side in
// the water, eight notes each.
const NOTE_H = 92;
const NOTE_GAP = 12;
const TALL_W = 364; // two notes of 156
const WIDE_W = 676; // four notes of 150

const zoneHeight = (count: number, cols: number) =>
  retroNotesTop(0) + stickyGridHeight(count, cols, NOTE_H, NOTE_GAP) + RETRO.pad;

const SCENE_W = 1540;
const WATERLINE = 24 + zoneHeight(8, 2) + 40;
const ZONE_TOP_BELOW = WATERLINE + 84;

const SCENE: SceneLayout = {
  width: SCENE_W,
  height: ZONE_TOP_BELOW + zoneHeight(8, 4) + 24,
  waterline: WATERLINE,
  boatX: 640,
  rocksX: 860,
  islandX: 1300,
  sunX: 1330,
  sunY: WATERLINE - 20,
};

const ZONES: Zone[] = [
  {
    label: 'Island',
    hint: 'Where are we sailing to?',
    icon: 'flag',
    hue: RETRO_HUES.amber,
    notes: [
      'Mobile app in the App Store by 1 March',
      '10k weekly active users by summer',
      'A 4.5 star rating or better',
      'Checkout in under a minute',
      'Offline mode for the commute',
      'Crash-free sessions above 99.5%',
      'Push alerts people keep switched on',
      'Web and app on one design system',
    ],
    x: SCENE_W - 24 - WIDE_W,
    y: 24,
    w: WIDE_W,
    cols: 4,
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
      'Beta testers send feedback daily',
      'New CI builds in six minutes',
      'Support flags bugs within hours',
      'Marketing has a launch budget',
    ],
    x: 24,
    y: 24,
    w: TALL_W,
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
      'Design reviews wait a week',
      'No test phones for older Androids',
      'Release sign-off needs three people',
      'Tech debt tickets never get picked',
    ],
    x: 24,
    y: ZONE_TOP_BELOW,
    w: WIDE_W,
    cols: 4,
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
      'iOS 19 changes the notification rules',
      'A competitor launches in February',
      'Our analytics SDK is being retired',
      'Two of us are on parental leave in Q1',
    ],
    x: 24 + WIDE_W + 32,
    y: ZONE_TOP_BELOW,
    w: SCENE_W - 24 - (24 + WIDE_W + 32),
    cols: 4,
  },
];

const SAIL_ACTIONS = [
  'Automate release smoke tests · Ravi · Fri',
  'Pair on the build pipeline · Mei · Wed',
  'Book App Store review early · Jo · 1 Feb',
  'Pause one side project · Sam · Mon',
  'Buy older Android test phones · Kim · Thu',
  'One debt ticket every sprint · Leo · Tue',
];

const VOYAGE = [
  { label: 'Check last voyage’s actions', minutes: 5 },
  { label: 'Name the island', minutes: 5 },
  { label: 'Wind', minutes: 8 },
  { label: 'Anchors', minutes: 8 },
  { label: 'Rocks', minutes: 8 },
  { label: 'Vote and act', minutes: 11 },
];

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
  const tempH = 340;
  const agendaY = top + tempH + 20;
  const agendaH = 340;
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

  // The scene, back to front: sky, the sun setting behind the horizon, sea,
  // island, rocks, boat.
  elements.push(
    ...sceneSky(sx, sy, SCENE),
    ...sceneSun(sx, sy, SCENE),
    ...sceneSea(sx, sy, SCENE),
    ...sceneIsland(sx, sy, SCENE),
    ...sceneRocks(sx, sy, SCENE),
    ...sceneBoat(sx, sy, SCENE),
  );

  // Wind: three gusts blowing from the Wind zone into the sails.
  const wind = ZONES.find((z) => z.label === 'Wind')!;
  const jibTop = SCENE.waterline - 298;
  [jibTop + 40, jibTop + 120, jibTop + 200].forEach((ly, i) => {
    const fromX = sx + wind.x + wind.w + 12;
    const toX = sx + jibEdgeX(SCENE, ly) - 14;
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
    const h = zoneHeight(z.notes.length, z.cols);
    elements.push(
      retroPanel(x, y, z.w, h, z.hue, { opacity: 0.94, borderRadius: 'lg' }),
      ...retroHeader(x, y, z.w, z.label, z.hint, z.icon, z.hue.headerColor).filter(
        (el) => !(el.type === 'shape' && el.shape === 'icon' && !el.iconId),
      ),
    );
    elements.push(
      ...stickyGrid(
        x + pad,
        retroNotesTop(y),
        z.w - pad * 2,
        NOTE_H,
        z.cols,
        z.notes,
        z.hue.sticky,
        NOTE_GAP,
      ),
    );
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
    // Three thank-yous stacked, so the room reads it as a pile to add to.
    ...stickyStack(
      actionsX + pad,
      shoutNoteTop,
      innerW,
      (top + bodyH - pad - shoutNoteTop - 2 * stickyGap) / 3,
      [
        'Thanks Priya for steering us through the beta launch!',
        'Kudos Ravi for the calm 2am rollback on Tuesday.',
        'Mei, your pipeline notes saved my week. Thank you!',
      ],
      { fill: '#fde68a', text: '#451a03' },
    ).map((note) => ({ ...note, textSize: 'md' as const })),
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
