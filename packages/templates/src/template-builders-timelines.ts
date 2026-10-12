// The quick Timeline template builder: the status-at-a-glance line of the
// timeline family. Split out of template-builders-diagrams, which had become
// the catch-all bucket. Its presentation siblings, the two milestone
// timelines, tell a story rather than track status and live in
// template-builders-milestones.ts.
//
// Pure: (cx, cy) -> Element[]. build-template dispatches here.
import { createArrow, createShape, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

const MUTED = '#64748b';

type Status = 'done' | 'current' | 'next';

// Each status owns a disc fill, its ring and the glyph colour inside it. The
// colour is the meaning (keyed by the legend), so every disc locks its fill.
const STATUS: Record<Status, { fill: string; stroke: string; glyph: string; legend: string }> = {
  done: { fill: '#22c55e', stroke: '#15803d', glyph: '#ffffff', legend: 'Done' },
  current: { fill: '#3b82f6', stroke: '#1d4ed8', glyph: '#ffffff', legend: 'In progress' },
  next: { fill: '#ffffff', stroke: '#94a3b8', glyph: '#64748b', legend: 'Up next' },
};

// Plateful's 2027 product year: six milestones evenly spaced (this is the
// glance view, not a to-scale one), each with a glyph, a date, a title and one
// line of what it means.
const MILESTONES: { title: string; date: string; detail: string; icon: string; status: Status }[] =
  [
    {
      title: 'Kick-off',
      date: 'January',
      detail: 'Group ordering picked as the bet',
      icon: 'flag',
      status: 'done',
    },
    {
      title: 'Prototype tested',
      date: 'March',
      detail: '9 of 12 households hooked',
      icon: 'users',
      status: 'done',
    },
    {
      title: 'Private beta',
      date: 'May',
      detail: '1,200 testers in three cities',
      icon: 'smartphone',
      status: 'done',
    },
    {
      title: 'Public launch',
      date: 'July',
      detail: 'Every city, every kitchen',
      icon: 'send',
      status: 'current',
    },
    {
      title: 'Kitchen tablet v2',
      date: 'September',
      detail: 'Group orders batched for chefs',
      icon: 'monitor',
      status: 'next',
    },
    {
      title: 'Year-two plan',
      date: 'November',
      detail: 'Pick the next bet together',
      icon: 'calendar',
      status: 'next',
    },
  ];

// The quick timeline: a year of product milestones on one forward-pointing
// line, ready to present. A bold title and a one-line how-to sit above it.
// The spine is drawn in two parts: a solid green run over what has happened
// and a slate run (with the arrowhead) over what is coming, so progress reads
// before any label does. Each milestone is a status-coloured disc carrying
// its glyph, with its date, title and a muted one-line detail stacked above
// or below (alternating, so six never crowd). The in-progress milestone is
// larger and its title bold. A dashed Today marker with a pill sits between
// it and the next milestone, ending just under the spine, and a legend keys
// the three statuses under the title. Lighter than the milestone timelines
// (no cards, no stems): the one to reach for when you need a
// status-at-a-glance line, not a story.
export function buildTimeline(cx: number, cy: number): Element[] {
  const lineLength = 1440;
  const dot = 52;
  const heroDot = 64;
  const labelW = 220;
  const dateH = 24;
  const titleH = 32;
  const detailH = 26;
  const blockH = dateH + titleH + detailH;
  const gap = 48;
  const titleTop = cy - gap - blockH - 190;
  const startX = cx - lineLength / 2;
  const x = (i: number) => startX + ((i + 0.5) / MILESTONES.length) * lineLength;
  const currentIndex = MILESTONES.findIndex((m) => m.status === 'current');
  const todayX = (x(currentIndex) + x(currentIndex + 1)) / 2;

  // Scaffold (docs/specs/006-document/layers.md): title, caption, spine and
  // legend stay put. Content: the milestones and the Today marker.
  const scaffold: Element[] = [
    {
      ...createText(startX, titleTop),
      width: lineLength,
      height: 44,
      label: 'Plateful · the 2027 product year',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(startX, titleTop + 44),
      width: lineLength,
      height: 28,
      label:
        'One line, one year. The colour says where each milestone stands; slide Today along as the year moves.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
    // Done so far: a heavier green run up to Today.
    {
      ...createArrow(startX, cy, todayX, cy),
      arrowEnds: 'none',
      strokeColor: '#22c55e',
      strokeWidth: 6,
      routeBehind: false,
    },
    // Still to come: slate, forward in time, so it carries the arrowhead.
    {
      ...createArrow(todayX, cy, startX + lineLength + 40, cy),
      strokeColor: '#94a3b8',
      strokeWidth: 3,
      routeBehind: false,
    },
  ];

  // Legend, under the caption on the left: one disc per status.
  const legendY = titleTop + 44 + 28 + 18;
  let lx = startX;
  for (const status of ['done', 'current', 'next'] as const) {
    const style = STATUS[status];
    scaffold.push(
      {
        ...createShape('circle', lx, legendY + 5),
        width: 18,
        height: 18,
        label: '',
        fillColor: style.fill,
        strokeColor: style.stroke,
        themeLockFill: true,
      },
      {
        ...createText(lx + 26, legendY),
        width: 110,
        height: 28,
        label: style.legend,
        textSize: 'sm',
        textAlignX: 'left',
        textColor: MUTED,
      },
    );
    // Each key steps on by its own label's width, so the gaps read even.
    lx += status === 'current' ? 150 : 110;
  }

  const content: Element[] = [];
  MILESTONES.forEach(({ title, date, detail, icon, status }, i) => {
    const style = STATUS[status];
    const size = status === 'current' ? heroDot : dot;
    content.push({
      ...createShape('circle', x(i) - size / 2, cy - size / 2),
      width: size,
      height: size,
      label: '',
      fillColor: style.fill,
      strokeColor: style.stroke,
      strokeWidth: 'thick',
      themeLockFill: true,
    });
    const g = Math.round(size * 0.46);
    content.push({
      ...createShape('icon', x(i) - g / 2, cy - g / 2),
      width: g,
      height: g,
      iconId: icon,
      strokeColor: style.glyph,
    });
    // Date, title, detail read top-down on both sides of the line.
    const above = i % 2 === 0;
    const top = above ? cy - gap - blockH : cy + gap;
    const left = x(i) - labelW / 2;
    content.push(
      {
        ...createText(left, top),
        width: labelW,
        height: dateH,
        label: date,
        textSize: 'sm',
        textBold: true,
        textAlignX: 'center',
        textColor: style.stroke === '#94a3b8' ? MUTED : style.stroke,
      },
      {
        ...createText(left, top + dateH),
        width: labelW,
        height: titleH,
        label: title,
        textSize: 'md',
        textBold: status === 'current',
        textAlignX: 'center',
      },
      {
        ...createText(left, top + dateH + titleH),
        width: labelW,
        height: detailH,
        label: detail,
        textSize: 'sm',
        textAlignX: 'center',
        textColor: MUTED,
      },
    );
  });

  // Today: a dashed marker between the in-progress milestone and the next
  // one (clear of both labels), from its pill down to just under the spine.
  const pillH = 34;
  const pillTop = cy - gap - blockH - pillH - 14;
  content.push(
    {
      ...createArrow(todayX, pillTop + pillH, todayX, cy + 34),
      arrowEnds: 'none',
      strokeStyle: 'dashed',
      strokeColor: '#e11d48',
      strokeWidth: 2,
      routeBehind: false,
    },
    {
      ...createShape('stadium', todayX - 44, pillTop),
      width: 88,
      height: pillH,
      label: 'Today',
      textSize: 'sm',
      textBold: true,
      fillColor: '#e11d48',
      strokeColor: '#e11d48',
      textColor: '#ffffff',
      themeLockFill: true,
    },
  );

  return [
    ...scaffold.map((el) => ({ ...el, layerId: TEMPLATE_SCAFFOLD_LAYER_ID })),
    ...content.map((el) => ({ ...el, layerId: TEMPLATE_CONTENT_LAYER_ID })),
  ];
}
