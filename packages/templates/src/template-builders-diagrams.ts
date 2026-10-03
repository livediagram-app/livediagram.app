// Per-template element builders for the diagram-style templates: pyramid and
// flywheel, plus re-exports of the Venn, journey map and fishbone. Split out of template-builders.ts to keep each file
// under the ~400-line target; build-template dispatches here. Each builder is
// pure: (cx, cy) -> Element[].
//
// The three timelines moved to ./template-builders-timelines, and the Venn,
// journey map and fishbone grew into files of their own
// (./template-builders-venn, -journey, -fishbone); they are re-exported below
// so build-template keeps one import for the family.
import {
  createArrow,
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

const MUTED = '#64748b';

// A true pyramid: one clean triangle banded into five tiers (Purpose at the
// peak down to Initiatives at the base). Each band is a triangle sharing the
// apex and the slope, drawn largest first, so every smaller one covers the
// top of the one behind it and what shows is exactly that tier's band; the
// slanted sides line up by construction. The bands ramp from a saturated
// peak to a pale foundation (kept light enough that the dark ink every light
// theme gives text stays legible on the locked fills), and a rail on the right gives every tier its
// guiding question plus a worked answer, so the template teaches the model
// while it scaffolds a real strategy.
export function buildPyramid(cx: number, cy: number): Element[] {
  type Tier = { label: string; question: string; answer: string; fill: string; ink: string };
  const tiers: Tier[] = [
    {
      label: 'Purpose',
      question: 'Why do we exist?',
      answer: 'Help every team think out loud, together',
      fill: '#3b82f6',
      ink: '#0f172a',
    },
    {
      label: 'Vision',
      question: 'Where are we going?',
      answer: 'The first canvas a team opens, by 2028',
      fill: '#60a5fa',
      ink: '#0f172a',
    },
    {
      label: 'Strategy',
      question: 'How will we win?',
      answer: 'Free, open and faster than a whiteboard',
      fill: '#93c5fd',
      ink: '#0f172a',
    },
    {
      label: 'Goals',
      question: 'What will we hit this year?',
      answer: '50k weekly teams, NPS 55',
      fill: '#bfdbfe',
      ink: '#0f172a',
    },
    {
      label: 'Initiatives',
      question: 'What are we doing now?',
      answer: 'Templates, live cursors, a mobile app',
      fill: '#e0ecff',
      ink: '#0f172a',
    },
  ];
  const baseW = 1000;
  const tierH = 112;
  const H = tiers.length * tierH;
  const railGap = 64;
  const railW = 380;
  // The rail hangs off the right, so shift the pyramid left by half of it to
  // keep the whole composition centred on (cx, cy).
  const px = cx - (railGap + railW) / 2;
  const top = cy - H / 2;
  // Half-width of the triangle at a given y.
  const half = (y: number) => ((y - top) / H) * (baseW / 2);
  // The triangle silhouette spans 2..98% of its box on both axes, so a band
  // whose visible triangle is h tall and w wide needs a box 1/0.96 larger,
  // nudged up and left by the 2% inset.
  const inset = 0.96;

  const bands: Element[] = [];
  const labels: Element[] = [];
  tiers.forEach((t, i) => {
    const y1 = top + (i + 1) * tierH;
    const visW = half(y1) * 2;
    const visH = y1 - top;
    const boxW = visW / inset;
    const boxH = visH / inset;
    bands.push({
      ...createShape('triangle', px - boxW / 2, top - boxH * 0.02),
      width: boxW,
      height: boxH,
      label: '',
      fillColor: t.fill,
      // The ramp is the reading order (peak = most enduring), so it
      // survives a theme switch.
      themeLockFill: true,
    });

    // Tier names are overlay text (the funnel's convention): a shape's own
    // label centres on its box, which here is the whole triangle above the
    // band. The apex name sits in its lower, wider half.
    const y0 = y1 - tierH;
    const nameY = i === 0 ? y1 - 44 : (y0 + y1) / 2 - 18;
    labels.push({
      ...createText(px - 120, nameY),
      width: 240,
      height: 36,
      label: t.label,
      textSize: 'md',
      textBold: true,
      textAlignX: 'center',
      textColor: t.ink,
    });

    // Rail: a dotted leader from the band's slanted edge, then the tier's
    // guiding question over a muted worked answer.
    const midY = (y0 + y1) / 2;
    const railX = px + baseW / 2 + railGap;
    labels.push({
      ...createArrow(px + half(midY) + 14, midY, railX - 14, midY),
      arrowEnds: 'none',
      strokeStyle: 'dotted',
      strokeColor: '#cbd5e1',
      routeBehind: false,
    });
    labels.push({
      ...createText(railX, midY - 32),
      width: railW,
      height: 30,
      label: t.question,
      textSize: 'md',
      textBold: true,
      textAlignX: 'left',
      textColor: '#1d4ed8',
    });
    labels.push({
      ...createText(railX, midY + 2),
      width: railW,
      height: 30,
      label: t.answer,
      textSize: 'sm',
      textAlignX: 'left',
      textColor: MUTED,
    });
  });
  // Largest band first, so each smaller one paints over the top of it.
  return [...bands.reverse(), ...labels];
}

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
