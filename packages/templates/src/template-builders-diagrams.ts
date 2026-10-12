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
  createPinnedArrow,
  createShape,
  createSticky,
  createText,
  type Anchor,
  type Element,
} from '@livediagram/document';
export { buildVenn } from './template-builders-venn';

export { buildJourney } from './template-builders-journey';
export { buildFishbone } from './template-builders-fishbone';
export { buildPyramid } from './template-builders-pyramid';

const MUTED = '#64748b';

// Flywheel: a worked growth loop for FreshBox (the meal-kit subscription the
// strategy canvases share) that reads as MOMENTUM, not a static four-up.
// Four stage wheels sit at 12 / 3 / 6 / 9 o'clock, each tinted its own hue
// (`themeLockFill`) with a role glyph over its name, and each names a cause
// that feeds the next: more subscribers → more weekly orders → better farm
// deals → lower box prices → more subscribers. Thick curved arrows run
// clockwise with a flowing-dash animation, and the hub's refresh glyph
// spins, so the loop visibly turns the moment the template lands. Every
// stage carries its current number outside the wheel (bold metric over a
// muted how). Two corner stickies name what a flywheel is worked with: a
// green PUSH that adds force and a rose FRICTION that slows a turn, which
// is the conversation the diagram exists to start.
type FlywheelStage = {
  angleDeg: number;
  label: string;
  icon: string;
  metric: string;
  how: string;
  fill: string;
  ink: string;
  // Anchors on THIS stage: `out` faces the next stage clockwise, `into`
  // faces the previous one, so every arrow stays outside the hub.
  out: Anchor;
  into: Anchor;
};

const FLYWHEEL_STAGES: FlywheelStage[] = [
  {
    angleDeg: -90,
    label: 'More subscribers',
    icon: 'users',
    metric: '2,400 active · ▲ 12% a month',
    how: 'Referrals and word of mouth',
    fill: '#dbeafe',
    ink: '#1e3a8a',
    out: 'e',
    into: 'w',
  },
  {
    angleDeg: 0,
    label: 'More weekly orders',
    icon: 'cart',
    metric: '9,000 boxes a week',
    how: 'Habit: the box just arrives',
    fill: '#dcfce7',
    ink: '#14532d',
    out: 's',
    into: 'n',
  },
  {
    angleDeg: 90,
    label: 'Better farm deals',
    icon: 'percent',
    metric: 'Ingredient cost ▼ 8%',
    how: 'Volume contracts with six farms',
    fill: '#fef3c7',
    ink: '#78350f',
    out: 'w',
    into: 'e',
  },
  {
    angleDeg: 180,
    label: 'Lower box prices',
    icon: 'tag',
    metric: '£39 → £35 for 3 dinners',
    how: 'Savings passed straight on',
    fill: '#ede9fe',
    ink: '#4c1d95',
    out: 'n',
    into: 's',
  },
];

export function buildFlywheel(cx: number, cy: number): Element[] {
  const hubSize = 220;
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
    {
      ...createShape('circle', cx - hubSize / 2, wy - hubSize / 2),
      width: hubSize,
      height: hubSize,
      label: 'Momentum',
      textSize: 'md',
      textBold: true,
      iconId: 'refresh-cw',
      iconPosition: 'above',
      iconAnimation: 'spin',
      iconAnimationSpeed: 'slow',
      // The hub drives the whole loop → hero preset.
      colorPreset: 'bold',
    },
  ];

  const stageEls = FLYWHEEL_STAGES.map((s) => {
    const rad = (s.angleDeg * Math.PI) / 180;
    return {
      ...createShape(
        'circle',
        cx + Math.cos(rad) * orbit - stageSize / 2,
        wy + Math.sin(rad) * orbit - stageSize / 2,
      ),
      width: stageSize,
      height: stageSize,
      label: s.label,
      textSize: 'md' as const,
      textBold: true,
      iconId: s.icon,
      iconPosition: 'above' as const,
      fillColor: s.fill,
      textColor: s.ink,
      // Each stage keeps its hue under every theme so the loop reads as
      // four distinct forces; the ink stays dark on the pale fill.
      themeLockFill: true,
    };
  });
  elements.push(...stageEls);

  // Captions outside each wheel: centred above / below the vertical pair,
  // pushed outward and aligned away from the wheel for the side pair.
  FLYWHEEL_STAGES.forEach((s, i) => {
    const el = stageEls[i]!;
    let x: number;
    let y: number;
    let align: 'left' | 'center' | 'right';
    if (s.angleDeg === -90) {
      [x, y, align] = [cx - captionW / 2, el.y - captionGap - metricH - howH, 'center'];
    } else if (s.angleDeg === 90) {
      [x, y, align] = [cx - captionW / 2, el.y + stageSize + captionGap, 'center'];
    } else if (s.angleDeg === 0) {
      [x, y, align] = [el.x + stageSize + captionGap, wy - (metricH + howH) / 2, 'left'];
    } else {
      [x, y, align] = [el.x - captionGap - captionW, wy - (metricH + howH) / 2, 'right'];
    }
    elements.push(
      {
        ...createText(x, y),
        width: captionW,
        height: metricH,
        label: s.metric,
        textSize: 'sm',
        textBold: true,
        textAlignX: align,
      },
      {
        ...createText(x, y + metricH),
        width: captionW,
        height: howH,
        label: s.how,
        textSize: 'sm',
        textColor: MUTED,
        textAlignX: align,
      },
    );
  });

  // Clockwise loop: curved so each connector arcs round the outside of the
  // wheel, thick so it reads as the drive belt, and flowing so it turns.
  FLYWHEEL_STAGES.forEach((s, i) => {
    const next = (i + 1) % FLYWHEEL_STAGES.length;
    elements.push({
      ...createPinnedArrow(stageEls[i]!.id, s.out, stageEls[next]!.id, FLYWHEEL_STAGES[next]!.into),
      arrowStyle: 'curved',
      strokeWidth: 3,
      strokeStyle: 'dashed',
      flow: 'dashes',
      flowSpeed: 'normal',
    });
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
