// The time views' still pictures (docs/specs/026-plan/plan-tabs.md "Export"): a Gantt's bars over its weeks and a
// Calendar's month with the cards on their days, from the live views' models, at the element's box. Pure.
import {
  WEEKDAY_SHORT,
  calendarModel,
  ganttAt,
  ganttModel,
  ganttShownTypes,
  itemColourOf,
  itemTitle,
  shiftMonth,
  typeIn,
  type CalendarField,
} from '@liveplanner/items';
import { accentOn } from '@liveplanner/document';
import { xmlEscape } from '@liveplanner/icons';
import { OVERDUE_RED } from './phase-colours';
import { ART_PAD, box, dot, emptyBody, line, viewFrame, r2 } from './plan-art-kit';
import type { ViewArtInput } from './plan-view-art';

const ROW_H = 28;
const AXIS_H = 22;

const titled = (name: string, own: string | undefined) => own?.trim() || name;

// The Gantt: a names column, the weeks along the top, a bar (or a diamond for a date alone) a row, today's line.
export function ganttArt({ rect, p, items, data, settings, title }: ViewArtInput): string {
  const model = ganttModel(
    items.values(),
    data.statusPhases,
    data.now,
    ganttShownTypes(settings, data.types),
  );
  const frame = viewFrame(rect, p, titled('Gantt Chart', title), model.rows.length);
  if (model.rows.length === 0)
    return frame.markup + emptyBody(frame.body, p, 'No projects with dates yet.');
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
  const room = Math.max(0, Math.floor((body.height - AXIS_H) / ROW_H));
  model.rows.slice(0, room).forEach((row, i) => {
    const y = body.y + AXIS_H + i * ROW_H;
    const colour = accentOn(itemColourOf(row.item) ?? typeIn(data.types, row.item.type).color, p);
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
          { fill: colour, rx: 4, opacity: row.isDone ? 0.5 : 1 },
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
      parts.push(
        `<path d="M${r2(cx)} ${r2(y + 6)}l7 8l-7 8l-7 -8z" fill="${xmlEscape(row.overdue ? OVERDUE_RED : colour)}"/>`,
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
  { rect, p, items, data, title }: ViewArtInput,
  field: CalendarField,
): string {
  const now = data.now;
  const shown = shiftMonth(now.getFullYear(), now.getMonth(), 0);
  const model = calendarModel(items.values(), data.statusPhases, shown.year, shown.month, field);
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
