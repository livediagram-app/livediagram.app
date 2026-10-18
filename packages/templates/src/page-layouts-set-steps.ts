// More Steps and Time layouts (docs/specs/007-editor/pages-mode.md "Layouts"), category
// 'steps': pure builders on the shared kit (page-layout-kit.ts), laid out in proportions of the
// page's content box so each fits every size and orientation, in the tab's theme. The how-to is
// here; the staircase and customer journey are in part 2, the project plan and decision flow in
// part 3.
import type { Element } from '@livediagram/document';
import { heading, kit, type Kit } from './page-layout-kit';
import { iconRow } from './page-layout-parts';
import type { PageLayout } from './page-layouts';
import { customerJourney, staircase } from './page-layouts-set-steps-2';
import { decisionFlow, projectPlan } from './page-layouts-set-steps-3';

export type StepsSetLayoutId =
  'staircase' | 'customer-journey' | 'project-plan' | 'decision-flow' | 'how-to';

const HOW_TO = [
  ['Grind', '100 g of beans, as coarse as sea salt.'],
  ['Combine', 'Stir into one litre of cold water.'],
  ['Steep', 'Cover and leave for 12 hours.'],
  ['Strain', 'Pour through a paper filter.'],
  ['Dilute', 'One part brew to one part water.'],
  ['Serve', 'Over ice, with milk if you like.'],
] as const;
const HOW_TO_META = [
  ['clock', '12 hours'],
  ['users', 'Serves 4'],
  ['star', 'Easy'],
] as const;

// A how-to: what it takes in a line of icons, then six photo steps, each photo numbered in its
// corner over the step's name and note. One row of six on a clearly wide page, three by two on a
// page near square or tall.
function howTo(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const tall = W < H * 0.85;
  const head = tall
    ? heading(k, 'Perfect cold brew', 'Smooth, strong and ready by morning.')
    : heading(k, 'Perfect cold brew');
  const metaH = u * 8;
  const metaW = W / HOW_TO_META.length;
  const els: Element[] = [
    ...head.els,
    ...HOW_TO_META.flatMap(([iconId, line], i) =>
      iconRow(k, i * metaW, head.top, metaW - u * 3, metaH, iconId, line),
    ),
  ];
  const gridTop = head.top + metaH + u * 7;
  const cols = W >= H * 1.3 ? 6 : 3;
  const rows = HOW_TO.length / cols;
  const gap = u * (cols === 6 ? 3 : 5);
  const cardW = (W - gap * (cols - 1)) / cols;
  const cardH = (H - gridTop - gap * (rows - 1)) / rows;
  // A narrow card's note wraps onto a third line.
  const noteH = cols === 6 ? u * 15 : u * 11;
  const textH = u * 9 + noteH;
  const imgH = cardH - textH;
  const d = Math.min(u * 11, imgH * 0.4, cardW * 0.3);
  HOW_TO.forEach(([name, note], i) => {
    const x = (i % cols) * (cardW + gap);
    const y = gridTop + Math.floor(i / cols) * (cardH + gap);
    els.push(
      k.image(x, y, cardW, imgH),
      // A Step number (docs/specs/009-elements/step-number.md) on the step's picture.
      k.shape('step', x + u * 3, y + u * 3, d, d, {
        label: `${i + 1}`,
        textBold: true,
        chipLook: 'solid',
      }),
      k.text(x, y + imgH + u * 2, cardW, u * 7, name, { textSize: 'lg', textBold: true }),
      k.text(x, y + imgH + u * 9, cardW, noteH, note),
    );
  });
  return els;
}

export const STEPS_SET_LAYOUTS: readonly PageLayout[] = [
  {
    id: 'staircase',
    category: 'steps',
    label: 'Staircase',
    description: 'Five rising levels, each a number, a name and a note',
    build: (b) => staircase(kit(b)),
  },
  {
    id: 'customer-journey',
    category: 'steps',
    label: 'Customer Journey',
    description: 'Five stages: what happens, where, how it feels and what to fix',
    build: (b) => customerJourney(kit(b)),
  },
  {
    id: 'project-plan',
    category: 'steps',
    label: 'Project Plan',
    description: 'Workstreams as bars across six weeks, a launch milestone and today',
    build: (b) => projectPlan(kit(b)),
  },
  {
    id: 'decision-flow',
    category: 'steps',
    label: 'Decision Flow',
    description: 'Three yes or no questions, each No ending in its own outcome',
    build: (b) => decisionFlow(kit(b)),
  },
  {
    id: 'how-to',
    category: 'steps',
    label: 'How-To',
    description: 'What it takes, then six numbered photo steps',
    build: (b) => howTo(kit(b)),
  },
];
