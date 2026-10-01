// The quick Timeline template builder: the status-at-a-glance line of the
// timeline family. Split out of template-builders-diagrams, which had become
// the catch-all bucket. Its presentation siblings, the two milestone
// timelines, tell a story rather than track status and live in
// template-builders-milestones.ts.
//
// Pure: (cx, cy) -> Element[]. build-template dispatches here.
import { createArrow, createShape, createText, type Element } from '@livediagram/document';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

// The quick timeline: a year of product milestones on one forward-pointing
// line. Each dot's colour says where the milestone stands (done / in
// progress / up next, keyed by a small legend), a dashed "Today" marker
// splits what has happened from what is coming, and labels alternate above
// and below so six milestones never crowd. Lighter than the milestone
// timelines (no cards, no stems): the one to reach for when you need a
// status-at-a-glance line, not a presentation.
export function buildTimeline(cx: number, cy: number): Element[] {
  type Status = 'done' | 'current' | 'next';
  const STATUS: Record<Status, { fill: string; stroke: string; legend: string }> = {
    done: { fill: '#22c55e', stroke: '#15803d', legend: 'Done' },
    current: { fill: '#3b82f6', stroke: '#1d4ed8', legend: 'In progress' },
    next: { fill: '#ffffff', stroke: '#94a3b8', legend: 'Up next' },
  };
  const milestones: { title: string; date: string; status: Status }[] = [
    { title: 'Kick-off', date: 'January', status: 'done' },
    { title: 'Prototype tested', date: 'March', status: 'done' },
    { title: 'Private beta', date: 'May', status: 'done' },
    { title: 'Public launch', date: 'July', status: 'current' },
    { title: 'Mobile app', date: 'September', status: 'next' },
    { title: 'Year-two plan', date: 'November', status: 'next' },
  ];
  const lineLength = 1320;
  const dot = 36;
  const labelW = 200;
  const titleH = 34;
  const dateH = 26;
  const verticalOffset = 44;
  const startX = cx - lineLength / 2;
  const x = (i: number) => startX + ((i + 0.5) / milestones.length) * lineLength;

  const elements: Element[] = [];
  // Spine: forward in time, so it carries an arrowhead at the future end.
  // It is the scaffold layer (docs/specs/006-document/layers.md); markers + labels ride the
  // content layer above it.
  elements.push({
    ...createArrow(startX, cy, startX + lineLength, cy),
    strokeColor: '#64748b',
    strokeWidth: 3,
    routeBehind: false,
    layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
  });

  milestones.forEach(({ title, date, status }, i) => {
    const style = STATUS[status];
    // The in-progress milestone is the one to look at, so it is larger.
    const size = status === 'current' ? dot + 12 : dot;
    elements.push({
      ...createShape('circle', x(i) - size / 2, cy - size / 2),
      width: size,
      height: size,
      label: '',
      fillColor: style.fill,
      strokeColor: style.stroke,
      strokeWidth: 'medium',
      // Status colour is meaning, so it survives a theme switch.
      themeLockFill: true,
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
    const above = i % 2 === 0;
    // Title nearest the line, date beyond it, mirrored below the line.
    const titleY = above ? cy - verticalOffset - titleH : cy + verticalOffset;
    const dateY = above ? titleY - dateH : titleY + titleH;
    elements.push({
      ...createText(x(i) - labelW / 2, titleY),
      width: labelW,
      height: titleH,
      label: title,
      textSize: 'md',
      textBold: status === 'current',
      textAlignX: 'center',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
    elements.push({
      ...createText(x(i) - labelW / 2, dateY),
      width: labelW,
      height: dateH,
      label: date,
      textSize: 'sm',
      textAlignX: 'center',
      textColor: '#64748b',
      layerId: TEMPLATE_CONTENT_LAYER_ID,
    });
  });

  // Today: a dashed marker midway between the in-progress milestone and the
  // next one (clear of both labels), tagged with a pill at its top. Drag it
  // along as the year moves.
  const todayX = (x(3) + x(4)) / 2;
  const markerTop = cy - verticalOffset - titleH - dateH - 18;
  const markerBottom = cy + verticalOffset + titleH + dateH + 6;
  elements.push({
    ...createArrow(todayX, markerTop + 36, todayX, markerBottom),
    arrowEnds: 'none',
    strokeStyle: 'dashed',
    strokeColor: '#e11d48',
    strokeWidth: 2,
    routeBehind: false,
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });
  elements.push({
    ...createShape('stadium', todayX - 44, markerTop),
    width: 88,
    height: 36,
    label: 'Today',
    textSize: 'sm',
    textBold: true,
    fillColor: '#e11d48',
    strokeColor: '#e11d48',
    textColor: '#ffffff',
    themeLockFill: true,
    layerId: TEMPLATE_CONTENT_LAYER_ID,
  });

  // Legend, bottom right under the line's end.
  const legendY = markerBottom + 34;
  let lx = startX + lineLength - 3 * 150;
  for (const status of ['done', 'current', 'next'] as const) {
    const style = STATUS[status];
    elements.push({
      ...createShape('circle', lx, legendY + 5),
      width: 18,
      height: 18,
      label: '',
      fillColor: style.fill,
      strokeColor: style.stroke,
      themeLockFill: true,
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    elements.push({
      ...createText(lx + 26, legendY),
      width: 110,
      height: 28,
      label: style.legend,
      textSize: 'sm',
      textAlignX: 'left',
      textColor: '#64748b',
      layerId: TEMPLATE_SCAFFOLD_LAYER_ID,
    });
    lx += 150;
  }
  return elements;
}
