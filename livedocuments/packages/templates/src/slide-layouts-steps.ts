// Slide steps and time (docs/specs/007-editor/pages-mode.md "Slide layouts", Steps and
// Time): how a thing unfolds, besides Process, Timeline, Roadmap, Funnel, Cycle and Project Plan.
// Pure builders on the slide kit, in units of the slide's height.
import { createPinnedArrow, type Element, type ShapeElement } from '@livedocuments/document';
import type { Kit } from './page-layout-kit';
import { bullets, card, columns, over, slideHeading, slideType } from './slide-layout-kit';

/** Four steps across as pills joined by arrows, a note under each. */
export function processFlowSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'How it works', 'From first idea to launch in four steps.');
  const steps = [
    ['Discover', 'Talk to the people with the problem.'],
    ['Design', 'Sketch it, test it, sketch it again.'],
    ['Build', 'Ship the smallest thing that works.'],
    ['Launch', 'Put it in hands and watch closely.'],
  ] as const;
  const pillH = u * 14;
  const y = head.top + u * 6;
  const pills: ShapeElement[] = [];
  const els: Element[] = [...head.els];
  columns(W, steps.length, u * 7).forEach(({ at, size }, i) => {
    const [name, note] = steps[i]!;
    const pill = k.shape('stadium', at, y, size, pillH, { label: '' });
    pills.push(pill);
    els.push(
      pill,
      over(k, at, y, size, pillH, name, 4.4),
      k.text(at, y + pillH + u * 6, size, H - (y + pillH + u * 6), note, {
        ...slideType(k, 3.6),
        textAlignX: 'center',
      }),
    );
  });
  for (let i = 1; i < pills.length; i += 1) {
    els.push(createPinnedArrow(pills[i - 1]!.id, 'e', pills[i]!.id, 'w'));
  }
  return els;
}

/** Five milestones along a rail: the year above each point, what happened under it. */
export function milestonesSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'How we got here');
  const points = [
    ['2019', 'Two founders, one idea'],
    ['2021', 'First thousand customers'],
    ['2023', 'Opened in Europe'],
    ['2025', 'One million users'],
    ['2026', 'What comes next'],
  ] as const;
  const railY = head.top + (H - head.top) * 0.4;
  const dot = u * 6;
  const cols = columns(W, points.length, u * 3);
  return [
    ...head.els,
    k.shape('square', 0, railY - u * 0.6, W, u * 1.2, { label: '', borderRadius: 'full' }),
    ...cols.flatMap(({ at, size }, i) => {
      const [year, note] = points[i]!;
      const cx = at + size / 2;
      return [
        k.shape('circle', cx - dot / 2, railY - dot / 2, dot, dot, { label: '' }),
        k.text(at, railY - dot / 2 - u * 16, size, u * 13, year, {
          ...slideType(k, 7),
          textBold: true,
          textAlignX: 'center',
          textAlignY: 'bottom',
        }),
        k.text(at, railY + dot / 2 + u * 5, size, H - (railY + dot / 2 + u * 5), note, {
          ...slideType(k, 4),
          textAlignX: 'center',
        }),
      ];
    }),
  ];
}

/** A roadmap in three columns: what we are doing now, next and later. */
export function nowNextLaterSlide(k: Kit): Element[] {
  const { width: W, height: H } = k.box;
  const { u } = k;
  const head = slideHeading(k, 'Roadmap');
  const lanes = [
    ['Now', ['Faster sign-up', 'Shared templates', 'Mobile editing']],
    ['Next', ['Team spaces', 'Comments on slides', 'Offline mode']],
    ['Later', ['Plugins', 'Live data', 'Translations']],
  ] as const;
  const cardH = H - head.top;
  const pad = u * 5;
  return [
    ...head.els,
    ...columns(W, lanes.length, u * 5).flatMap(({ at, size }, i) => {
      const [name, items] = lanes[i]!;
      return [
        card(k, at, head.top, size, cardH),
        k.text(at + pad, head.top + pad, size - 2 * pad, u * 9, name, {
          ...slideType(k, 5.4),
          textBold: true,
        }),
        ...bullets(
          k,
          at + pad,
          head.top + pad + u * 13,
          size - 2 * pad,
          cardH - 2 * pad - u * 13,
          items,
          3.6,
        ),
      ];
    }),
  ];
}
