// Gantt-chart template builder (docs/specs/008-canvas/canvas-and-palette.md "Templates").
//
// A real delivery plan rather than a row of coloured blocks: twelve weeks of
// a mobile-app launch on a two-tier calendar (months over week-commencing
// dates), split into three workstreams (Design / Build / Launch) that each
// open with a group row and a thin summary bar spanning their tasks. Every
// task row names the work and its owner (an initials avatar) in a left-hand
// table, and its bar is a PROGRESS BAR element (docs/specs/009-elements/progress.md)
// snapped to the week grid, so "how far along is it?" is the bar itself and
// is set from the context menu. Finish-to-start dependencies are pinned
// elbow arrows between bars, the launch is an amber milestone diamond, and a
// dashed red Today line (the Timeline's marker grammar) shows at a glance
// what is behind: the API is flagged AT RISK because Today is two-thirds of
// the way through its span with only half of it done.
//
// The calendar, table, bands and gridlines are the "Grid" scaffold layer;
// bars, summaries, dependencies, the milestone and Today are the "Bars"
// content layer, so the plan can be re-scheduled with the grid locked.
// Bar tracks and avatar fills are `themeLockFill`-locked: a theme's single
// element fill would otherwise merge the three workstreams into one colour.
import {
  createArrow,
  createPinnedArrow,
  createShape,
  createText,
  type Element,
} from '@livediagram/document';
import {
  DEPENDENCIES,
  LAUNCH_WEEK,
  MONTHS,
  PEOPLE,
  PLAN,
  STREAMS,
  TODAY_WEEK,
  WEEK_DATES,
} from './template-gantt-plan';
import { TEMPLATE_CONTENT_LAYER_ID, TEMPLATE_SCAFFOLD_LAYER_ID } from './template-layers';

const MUTED = '#64748b';
const INK = '#0f172a';
const GRID_LINE = '#e2e8f0';
const MONTH_LINE = '#cbd5e1';
const TODAY = '#e11d48';

export function buildGanttChart(cx: number, cy: number): Element[] {
  const weekW = 76;
  const taskColW = 250;
  const ownerColW = 130;
  const tableW = taskColW + ownerColW;
  const chartW = WEEK_DATES.length * weekW;
  const totalW = tableW + chartW;
  const titleH = 48;
  const captionH = 28;
  const todayGap = 44; // room above the calendar for the Today pill
  const monthH = 34;
  const weekH = 30;
  const groupH = 40;
  const rowH = 48;
  const barH = 26;
  const pad = 16;

  const rowCount = PLAN.reduce((n, g) => n + g.tasks.length, 0) + 1; // + the milestone row
  const bodyH = PLAN.length * groupH + rowCount * rowH;
  const totalH = titleH + captionH + todayGap + monthH + weekH + bodyH;
  const left = cx - totalW / 2;
  const top = cy - totalH / 2;
  const calTop = top + titleH + captionH + todayGap;
  const bodyTop = calTop + monthH + weekH;
  const bottom = bodyTop + bodyH;
  const chartLeft = left + tableW;
  const weekX = (w: number) => chartLeft + w * weekW;

  const scaffold: Element[] = [];
  const content: Element[] = [];
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, width = 1) => ({
    ...createArrow(x1, y1, x2, y2),
    arrowEnds: 'none' as const,
    strokeColor: color,
    strokeWidth: width,
    routeBehind: false,
  });

  scaffold.push(
    {
      ...createText(left, top),
      width: totalW,
      height: titleH,
      label: 'Tandem mobile app · launch plan, Q1 2027',
      textSize: 'lg',
      textBold: true,
      textAlignX: 'left',
    },
    {
      ...createText(left, top + titleH),
      width: totalW,
      height: captionH,
      label:
        'Drag a bar to reschedule it, stretch it to change its length, set % done from its menu, and slide Today along each week.',
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
    },
    // The sheet: one pale surface under the calendar and rows, so the
    // backdrop's graph paper never competes with the week grid.
    {
      ...createShape('square', left, calTop),
      width: totalW,
      height: monthH + weekH + bodyH,
      fillColor: '#ffffff',
      strokeColor: MONTH_LINE,
    },
    {
      ...createShape('square', left, calTop),
      width: totalW,
      height: monthH + weekH,
      fillColor: '#f1f5f9',
      strokeColor: MONTH_LINE,
    },
    {
      ...createText(left + pad, calTop + monthH),
      width: taskColW - pad,
      height: weekH,
      label: 'Task',
      textSize: 'sm',
      textBold: true,
      textColor: MUTED,
      textAlignX: 'left',
    },
    {
      ...createText(left + taskColW, calTop + monthH),
      width: ownerColW,
      height: weekH,
      label: 'Owner',
      textSize: 'sm',
      textBold: true,
      textColor: MUTED,
      textAlignX: 'left',
    },
  );
  MONTHS.forEach((month, i) => {
    scaffold.push({
      ...createText(weekX(i * 4), calTop),
      width: weekW * 4,
      height: monthH,
      label: `${month} 2027`,
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
      padding: 'md',
    });
  });
  WEEK_DATES.forEach((date, i) => {
    scaffold.push({
      ...createText(weekX(i), calTop + monthH),
      width: weekW,
      height: weekH,
      label: date,
      textSize: 'sm',
      textColor: MUTED,
      textAlignX: 'left',
      padding: 'md',
    });
  });

  // Rows: a tinted group row per workstream, then its tasks.
  const bars = new Map<string, Element>();
  let y = bodyTop;
  for (const group of PLAN) {
    const stream = STREAMS[group.stream];
    scaffold.push(
      {
        // Unlocked on purpose, like the journey map's bands: the tint is
        // decoration, and other themes repaint it for contrast.
        ...createShape('square', left, y),
        width: totalW,
        height: groupH,
        fillColor: stream.band,
        strokeColor: stream.band,
      },
      {
        ...createShape('icon', left + pad, y + (groupH - 20) / 2),
        width: 20,
        height: 20,
        iconId: stream.icon,
        strokeColor: stream.deep,
      },
      {
        ...createText(left + pad + 28, y),
        width: taskColW - pad - 28,
        height: groupH,
        label: stream.name,
        textSize: 'md',
        textBold: true,
        textColor: stream.deep,
        textAlignX: 'left',
      },
    );
    // Summary bar: the workstream's whole span, the MS Project bracket.
    const first = Math.min(...group.tasks.map((t) => t.start));
    const last = Math.max(...group.tasks.map((t) => t.start + t.weeks));
    content.push({
      ...createShape('square', weekX(first) + 4, y + groupH / 2 - 4),
      width: (last - first) * weekW - 8,
      height: 8,
      fillColor: stream.deep,
      strokeColor: stream.deep,
      strokeWidth: 'none',
      borderRadius: 'sm',
      themeLockFill: true,
    });
    y += groupH;

    for (const task of group.tasks) {
      scaffold.push({
        ...createText(left + pad + 28, y),
        width: taskColW - pad - 28,
        height: rowH,
        label: task.label,
        textSize: 'sm',
        textAlignX: 'left',
      });
      scaffold.push(...ownerCell(left + taskColW, y + (rowH - 26) / 2, task.owner));
      const bar: Element = {
        ...createShape('progress-bar', weekX(task.start) + 4, y + (rowH - barH) / 2),
        width: task.weeks * weekW - 8,
        height: barH,
        progress: task.progress,
        fillColor: stream.track,
        strokeColor: stream.done,
        textColor: stream.deep,
        themeLockFill: true,
      };
      bars.set(task.key, bar);
      content.push(bar);
      y += rowH;
    }
  }

  // The milestone row: the launch is a moment, not a duration.
  scaffold.push(
    {
      ...createShape('icon', left + pad, y + (rowH - 20) / 2),
      width: 20,
      height: 20,
      iconId: 'flag',
      strokeColor: '#b45309',
    },
    {
      ...createText(left + pad + 28, y),
      width: taskColW - pad - 28,
      height: rowH,
      label: 'Launch day',
      textSize: 'sm',
      textBold: true,
      textAlignX: 'left',
    },
    ...ownerCell(left + taskColW, y + (rowH - 26) / 2, 'Sam'),
  );
  const diamond = 30;
  const launchX = weekX(LAUNCH_WEEK);
  const launch: Element = {
    ...createShape('diamond', launchX - diamond / 2, y + (rowH - diamond) / 2),
    width: diamond,
    height: diamond,
    fillColor: '#f59e0b',
    strokeColor: '#b45309',
    themeLockFill: true,
  };
  bars.set('launch', launch);
  const rocket = 34;
  content.push(launch, {
    ...createText(launchX - diamond / 2 - 108, y),
    width: 100,
    height: rowH,
    label: 'Wed 24 Mar',
    textSize: 'sm',
    textBold: true,
    textAlignX: 'right',
  });
  content.push({
    ...createShape('sticker', launchX - diamond / 2 - 108 - rocket - 4, y + (rowH - rocket) / 2),
    width: rocket,
    height: rocket,
    stickerId: 'emoji-rocket',
  });

  // Gridlines over the bands: a hairline per week, a firmer line per month
  // (and between the table and the calendar), plus the Owner column rule.
  for (let w = 1; w < WEEK_DATES.length; w++) {
    const month = w % 4 === 0;
    scaffold.push(
      line(
        weekX(w),
        month ? calTop : calTop + monthH,
        weekX(w),
        bottom,
        month ? MONTH_LINE : GRID_LINE,
      ),
    );
  }
  scaffold.push(line(chartLeft, calTop, chartLeft, bottom, MONTH_LINE));
  scaffold.push(line(left, calTop + monthH, chartLeft, calTop + monthH, MONTH_LINE));

  // Dependencies: pinned elbows from a bar's end to its successor's start,
  // so dragging either bar keeps the link attached.
  for (const [from, to] of DEPENDENCIES) {
    content.push({
      ...createPinnedArrow(bars.get(from)!.id, 'e', bars.get(to)!.id, 'w'),
      arrowStyle: 'angled',
      strokeColor: '#475569',
      strokeWidth: 1.5,
      routeBehind: false,
    });
  }

  // The API is two-thirds through its time but only half done: flag it for
  // the room, stuck on the bar's corner like a sticker on a card.
  const api = bars.get('api') as Extract<Element, { type: 'shape' }>;
  const badgeH = 26;
  content.push({
    ...createShape('sticker', api.x + api.width - badgeH * 2, api.y - 16),
    width: badgeH * 2.5,
    height: badgeH,
    stickerId: 'badge-at-risk',
    rotation: 3,
  });

  // Today: a dashed red line down the calendar, tagged with a pill above it.
  const todayX = weekX(TODAY_WEEK);
  content.push(
    {
      ...line(todayX, calTop - 6, todayX, bottom, TODAY, 2),
      strokeStyle: 'dashed',
    },
    {
      ...createShape('stadium', todayX - 44, calTop - todayGap + 4),
      width: 88,
      height: 32,
      label: 'Today',
      textSize: 'sm',
      textBold: true,
      fillColor: TODAY,
      strokeColor: TODAY,
      textColor: '#ffffff',
      themeLockFill: true,
    },
  );

  return [
    ...scaffold.map((el) => ({ ...el, layerId: TEMPLATE_SCAFFOLD_LAYER_ID })),
    ...content.map((el) => ({ ...el, layerId: TEMPLATE_CONTENT_LAYER_ID })),
  ];
}

// An owner cell: an initials avatar in the person's colour, then their name.
function ownerCell(x: number, y: number, name: string): Element[] {
  const size = 26;
  return [
    {
      ...createShape('circle', x, y),
      width: size,
      height: size,
      label: name.slice(0, 1),
      textSize: 'sm',
      textBold: true,
      fillColor: PEOPLE[name],
      strokeColor: '#ffffff',
      textColor: '#ffffff',
      themeLockFill: true,
    },
    {
      ...createText(x + size + 8, y - 4),
      width: 90,
      height: size + 8,
      label: name,
      textSize: 'sm',
      textColor: INK,
      textAlignX: 'left',
    },
  ];
}
