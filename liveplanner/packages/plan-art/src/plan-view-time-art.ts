// The time views' still pictures (docs/specs/026-plan/plan-tabs.md "Export"): a Gantt's bars over its weeks and a
// Calendar's month with the cards on their days, from the live views' models, at the element's box. Pure.
import {
  WEEKDAY_SHORT,
  blockingIndexOf,
  calendarModel,
  donePhase,
  ganttArrowPath,
  ganttArrows,
  ganttMarkEnds,
  ganttAt,
  ganttLanes,
  ganttLayout,
  ganttModel,
  ganttOrderRows,
  ganttShownTypes,
  viewDatesOf,
  itemColourOf,
  itemTitle,
  shiftMonth,
  typeIn,
  type CalendarField,
} from '@liveplanner/items';
import { accentOn } from '@liveplanner/project';
import { xmlEscape } from '@liveworkspace/icons';
import { OVERDUE_RED } from './phase-colours';
import { ART_PAD, box, dot, emptyBody, line, viewFrame, r2 } from './plan-art-kit';
import type { ViewArtInput } from './plan-view-art';

const ROW_H = 28;
const AXIS_H = 22;
// A swimlane's header row, as the live chart's (plan-views.md "Swimlanes") at the picture's scale.
const LANE_H = 22;

const titled = (name: string, own: string | undefined) => own?.trim() || name;

// The Gantt: a names column, the weeks along the top, a bar (or a diamond for a date alone) a row, an arrow from each
// blocker to each row it blocks (docs/specs/026-plan/plan-views.md "Dependency arrows"), today's line.
export function ganttArt({ rect, p, items, data, settings, title }: ViewArtInput): string {
  const model = ganttModel(
    items.values(),
    data.statusPhases,
    data.now,
    ganttShownTypes(settings, data.types),
    viewDatesOf(settings, data.types),
  );
  const frame = viewFrame(rect, p, titled('Gantt Chart', title), model.rows.length);
  if (model.rows.length === 0)
    return frame.markup + emptyBody(frame.body, p, 'No plans with dates yet.');
  const body = frame.body;
  const namesW = Math.min(220, Math.floor(body.width / 3));
  const trackX = body.x + namesW;
  const trackW = Math.max(1, body.width - namesW - ART_PAD);
  const at = (day: number) => trackX + ganttAt(model, day) * trackW;
  const parts = [frame.markup];
  parts.push(
    `<line x1="${r2(trackX)}" y1="${r2(body.y)}" x2="${r2(trackX)}" y2="${r2(body.y + body.height)}" stroke="${xmlEscape(p.border)}" stroke-width="1"/>`,
  );
  for (const tick of model.ticks) {
    const x = at(tick.day);
    parts.push(line(x + 3, body.y + 15, tick.label, { size: 10, color: p.muted }));
    parts.push(
      `<line x1="${r2(x)}" y1="${r2(body.y + AXIS_H)}" x2="${r2(x)}" y2="${r2(body.y + body.height)}" stroke="${xmlEscape(p.border)}" stroke-width="1" stroke-opacity="0.6"/>`,
    );
  }
  // In the chart's own row order (plan-views.md "Row order") and its swimlanes, every lane open, as the live chart
  // draws them: each lane's header row then its rows, as many as fit.
  const lanes = ganttLanes(
    ganttOrderRows(model.rows, settings.rowOrder),
    settings.swimlaneBy,
    settings.swimlaneField,
    items,
    data.types,
    data.statusNames,
  );
  const top0 = body.y + AXIS_H;
  const fits = (e: { top: number }, h: number) => top0 + e.top + h <= body.y + body.height;
  const entries = ganttLayout(lanes, new Set(), ROW_H, LANE_H).entries.filter((e) =>
    fits(e, e.kind === 'lane' ? LANE_H : ROW_H),
  );
  const shown = entries.flatMap((e) => (e.kind === 'row' ? [{ row: e.row, top: top0 + e.top }] : []));
  for (const e of entries) {
    if (e.kind !== 'lane') continue;
    const y = top0 + e.top;
    parts.push(box({ x: body.x, y, width: body.width, height: LANE_H }, { fill: p.column }));
    let x = body.x + ART_PAD;
    if (e.lane.colour) {
      parts.push(dot(x + 4, y + LANE_H / 2, 4, accentOn(e.lane.colour, p)));
      x += 14;
    }
    const label = line(x, y + 15, e.lane.label, {
      size: 11,
      weight: 600,
      color: p.text,
      width: namesW - (x - body.x) - ART_PAD - 24,
    });
    parts.push(label);
    parts.push(
      line(body.x + namesW - ART_PAD, y + 15, String(e.count), {
        size: 11,
        color: p.muted,
        anchor: 'end',
      }),
    );
  }
  const arrows = ganttArrows(
    shown,
    blockingIndexOf(items.values(), data.types, donePhase(data.statusPhases)),
    data.statusPhases,
  );
  for (const a of arrows) {
    const from = ganttMarkEnds(a.from.row, at, 7);
    const to = ganttMarkEnds(a.to.row, at, 7);
    const { d, head } = ganttArrowPath(
      { x: from.right, y: a.from.top + ROW_H / 2 },
      { x: to.left, y: a.to.top + ROW_H / 2 },
      ROW_H,
    );
    parts.push(
      `<g opacity="${a.done ? 0.4 : 1}" color="${xmlEscape(p.muted)}"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="${head}" fill="currentColor"/></g>`,
    );
  }
  shown.forEach(({ row, top: y }) => {
    const type = typeIn(data.types, row.item.type);
    const colour = accentOn(itemColourOf(row.item, type) ?? type.color, p);
    parts.push(
      line(body.x + ART_PAD, y + 18, itemTitle(row.item).trim() || 'Untitled', {
        size: 12,
        color: row.isDone ? p.muted : p.text,
        width: namesW - ART_PAD * 2,
        strike: row.isDone,
      }),
    );
    if (row.from === undefined || row.to === undefined) return;
    if (row.mark === 'bar') {
      const x = at(row.from);
      const w = Math.max(4, at(row.to + 1) - x);
      parts.push(
        box(
          { x, y: y + 7, width: w, height: 14 },
          // An overdue project's edge is red, over its Colour, as the live bar draws it.
          {
            fill: colour,
            rx: 4,
            opacity: row.isDone ? 0.5 : 1,
            ...(row.overdue ? { stroke: OVERDUE_RED, strokeWidth: 2 } : {}),
          },
        ),
      );
      if (row.total > 0)
        parts.push(
          box(
            { x, y: y + 18, width: (w * row.done) / row.total, height: 3 },
            { fill: p.text, rx: 1, opacity: 0.35 },
          ),
        );
    } else {
      const cx = (at(row.from) + at(row.from + 1)) / 2;
      // A diamond on the day: filled for a due date, hollow (the chart's surface inside its edge) for a start.
      const edge = xmlEscape(row.overdue ? OVERDUE_RED : colour);
      const fill = row.mark === 'due' ? edge : xmlEscape(p.surface);
      parts.push(
        `<path d="M${r2(cx)} ${r2(y + 6)}l7 8l-7 8l-7 -8z" fill="${fill}" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/>`,
      );
    }
  });
  const today = (at(model.today) + at(model.today + 1)) / 2;
  parts.push(
    `<line x1="${r2(today)}" y1="${r2(body.y + AXIS_H)}" x2="${r2(today)}" y2="${r2(body.y + body.height)}" stroke="${xmlEscape(OVERDUE_RED)}" stroke-width="1.5"/>`,
  );
  return parts.join('');
}

// A Calendar: this month's weeks, each day its date and its cards (a line each, as many as fit, then "+2").
export function calendarArt(
  { rect, p, items, data, settings, title }: ViewArtInput,
  field: CalendarField,
): string {
  const now = data.now;
  const shown = shiftMonth(now.getFullYear(), now.getMonth(), 0);
  const model = calendarModel(
    items.values(),
    data.statusPhases,
    shown.year,
    shown.month,
    field,
    viewDatesOf(settings, data.types),
  );
  const name = field === 'start' ? 'Start Calendar' : 'Due Calendar';
  const frame = viewFrame(rect, p, `${titled(name, title)} · ${model.label}`, model.count);
  const body = frame.body;
  const parts = [frame.markup];
  const colW = (body.width - ART_PAD * 2) / 7;
  const top = body.y + 22;
  WEEKDAY_SHORT.forEach((d, i) => {
    parts.push(
      line(body.x + ART_PAD + i * colW + colW / 2, body.y + 15, d, {
        size: 10,
        weight: 600,
        color: p.muted,
        anchor: 'middle',
      }),
    );
  });
  const rows = model.weeks.length;
  const dayH = (body.y + body.height - ART_PAD - top) / Math.max(1, rows);
  const entryH = 15;
  model.weeks.forEach((week, r) => {
    week.forEach((cell, c) => {
      const x = body.x + ART_PAD + c * colW;
      const y = top + r * dayH;
      parts.push(
        box(
          { x: x + 1, y: y + 1, width: colW - 2, height: dayH - 2 },
          { fill: cell.inMonth ? p.column : p.surface, rx: 4 },
        ),
      );
      parts.push(
        line(x + 6, y + 13, String(cell.date), {
          size: 10,
          weight: 600,
          color: cell.inMonth ? p.text : p.muted,
        }),
      );
      const room = Math.max(0, Math.floor((dayH - 18) / entryH));
      const fits = cell.cards.length > room ? Math.max(0, room - 1) : cell.cards.length;
      cell.cards.slice(0, fits).forEach(({ item, done }, k) => {
        const ey = y + 18 + k * entryH;
        parts.push(dot(x + 8, ey + 6, 3, accentOn(typeIn(data.types, item.type).color, p)));
        parts.push(
          line(x + 14, ey + 10, itemTitle(item).trim() || 'Untitled', {
            size: 10,
            color: done ? p.muted : p.text,
            width: colW - 18,
            strike: done,
          }),
        );
      });
      if (fits < cell.cards.length && room > 0)
        parts.push(
          line(x + 6, y + 18 + fits * entryH + 10, `+${cell.cards.length - fits}`, {
            size: 10,
            weight: 600,
            color: p.muted,
          }),
        );
    });
  });
  return parts.join('');
}
