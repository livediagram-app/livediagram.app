// Per-template element builders for the diagram-style templates: the
// flywheel, plus re-exports of the Venn, journey map, fishbone and pyramid. Split out of template-builders.ts to keep each file
// under the ~400-line target; build-template dispatches here. Each builder is
// pure: (cx, cy) -> Element[].
//
// The three timelines moved to ./template-builders-timelines, and the Venn,
// journey map, fishbone and pyramid grew into files of their own
// (./template-builders-venn, -journey, -fishbone, -pyramid); they are re-exported below
// so build-template keeps one import for the family.
import {
  cycleLayout,
  createShape,
  createSticky,
  createText,
  type Element,
} from '@livedesign/document';
export { buildVenn } from './template-builders-venn';

export { buildJourney } from './template-builders-journey';
export { buildFishbone } from './template-builders-fishbone';
export { buildPyramid } from './template-builders-pyramid';

const MUTED = '#64748b';

// Flywheel: a worked growth loop for FreshBox (the meal-kit subscription the
// strategy canvases share) that reads as MOMENTUM, not a static four-up.
// One Cycle element holds the four stages at 12 / 3 / 6 / 9 o'clock, each
// naming a cause that feeds the next: more subscribers → more weekly orders →
// better farm deals → lower box prices → more subscribers. Its arcs run
// clockwise with the Flow animation, and the hub's refresh glyph spins over
// Momentum at its centre, so the loop visibly turns the moment it lands. Every
// stage carries its current number outside the wheel (bold metric over a
// muted how). Two corner stickies name what a flywheel is worked with: a
// green PUSH that adds force and a rose FRICTION that slows a turn, which
// is the conversation the diagram exists to start.
type FlywheelStage = {
  angleDeg: number;
  label: string;
  metric: string;
  how: string;
};

// The wheel's colours: the steps' ring and arcs, and the pale fill inside each step.
const WHEEL_ACCENT = '#2563eb';
const WHEEL_FILL = '#eff6ff';

const FLYWHEEL_STAGES: FlywheelStage[] = [
  {
    angleDeg: -90,
    label: 'More subscribers',
    metric: '2,400 active · ▲ 12% a month',
    how: 'Referrals and word of mouth',
  },
  {
    angleDeg: 0,
    label: 'More weekly orders',
    metric: '9,000 boxes a week',
    how: 'Habit: the box just arrives',
  },
  {
    angleDeg: 90,
    label: 'Better farm deals',
    metric: 'Ingredient cost ▼ 8%',
    how: 'Volume contracts with six farms',
  },
  {
    angleDeg: 180,
    label: 'Lower box prices',
    metric: '£39 → £35 for 3 dinners',
    how: 'Savings passed straight on',
  },
];

export function buildFlywheel(cx: number, cy: number): Element[] {
  const stageSize = 216;
  const orbit = 290;
  const captionW = 240;
  const captionGap = 20;
  const metricH = 30;
  const howH = 24;
  const titleH = 48;
  const subtitleH = 28;
  const reach = orbit + stageSize / 2;
  const halfW = reach + captionGap + captionW;
  // The title block sits above the top caption and the bottom caption hangs
  // below the wheel, so the wheel centre drops by half the difference to
  // keep the whole composition centred on (cx, cy).
  const above = reach + captionGap + metricH + howH + 24 + titleH + subtitleH;
  const below = reach + captionGap + metricH + howH;
  const wy = cy + (above - below) / 2;
  const x0 = cx - halfW;
  const y0 = wy - above;

  const elements: Element[] = [
    {
      ...createText(x0, y0),
      width: halfW * 2,
      height: titleH,
      label: 'FreshBox growth flywheel',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(x0, y0 + titleH),
      width: halfW * 2,
      height: subtitleH,
      label:
        'Each stage feeds the next. Add push where the wheel is slow, and remove the friction that stops a turn.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
  ];

  // The wheel is one Cycle (docs/specs/009-elements/concept-graphics.md): the four stages round a ring, joined
  // clockwise, with Momentum at its centre. Its Flow animation marches along the arcs, so the wheel visibly turns the
  // moment the template lands; theme-locked so the loop keeps its colours.
  const size = reach * 2;
  const wheel: Element = {
    ...createShape('cycle', cx - reach, wy - reach),
    width: size,
    height: size,
    label: 'Momentum',
    textSize: 'md',
    textBold: true,
    conceptRows: FLYWHEEL_STAGES.map((st) => ({ label: st.label })),
    conceptAnim: 'flow',
    conceptAnimSpeed: 'normal',
    strokeColor: WHEEL_ACCENT,
    fillColor: WHEEL_FILL,
    themeLockFill: true,
  };
  elements.push(wheel);
  // The hub's refresh glyph spins above its word, as the drive of the whole loop.
  const hubIcon = 56;
  elements.push({
    ...createShape('icon', cx - hubIcon / 2, wy - hubIcon - 18),
    width: hubIcon,
    height: hubIcon,
    iconId: 'refresh-cw',
    iconAnimation: 'spin',
    iconAnimationSpeed: 'slow',
    strokeColor: WHEEL_ACCENT,
  });
  const layout = cycleLayout(size, size, FLYWHEEL_STAGES.length);

  // Captions outside each step: centred above / below the vertical pair, pushed outward and aligned away from the
  // wheel for the side pair.
  FLYWHEEL_STAGES.forEach((st, i) => {
    const disc = layout.discs[i]!;
    const dx = cx - reach + disc.x;
    const dy = wy - reach + disc.y;
    const r = layout.discR;
    let x: number;
    let y: number;
    let align: 'left' | 'center' | 'right';
    if (st.angleDeg === -90) {
      [x, y, align] = [dx - captionW / 2, dy - r - captionGap - metricH - howH, 'center'];
    } else if (st.angleDeg === 90) {
      [x, y, align] = [dx - captionW / 2, dy + r + captionGap, 'center'];
    } else if (st.angleDeg === 0) {
      [x, y, align] = [dx + r + captionGap, dy - (metricH + howH) / 2, 'left'];
    } else {
      [x, y, align] = [dx - r - captionGap - captionW, dy - (metricH + howH) / 2, 'right'];
    }
    elements.push(
      {
        ...createText(x, y),
        width: captionW,
        height: metricH,
        label: st.metric,
        textSize: 'sm',
        textBold: true,
        textAlignX: align,
      },
      {
        ...createText(x, y + metricH),
        width: captionW,
        height: howH,
        label: st.how,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: align,
      },
    );
  });

  // The two forces, in the empty corners between the arcs: push top-left
  // (where the cheaper box wins the next subscriber), friction bottom-right
  // (where orders are waiting on the farms).
  const noteW = 230;
  const noteH = 84;
  const corner = reach + captionGap - noteW / 2;
  elements.push(
    {
      ...createSticky(cx - corner - noteW / 2 - 40, wy - reach - 10),
      width: noteW,
      height: noteH,
      label: 'Push · Refer a friend and you both get a box free',
      textSize: 'sm',
      fillColor: '#bbf7d0',
      textColor: '#052e16',
    },
    {
      ...createSticky(cx + corner - noteW / 2 + 40, wy + reach + 10 - noteH),
      width: noteW,
      height: noteH,
      label: 'Friction · Sunday delivery slots sell out by Thursday',
      textSize: 'sm',
      fillColor: '#fecdd3',
      textColor: '#4c0519',
    },
  );

  return elements;
}
