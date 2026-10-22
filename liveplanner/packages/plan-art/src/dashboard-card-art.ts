// A Dashboard slot's written content as a still picture (docs/specs/026-plan/plan-tabs.md "Export"): a note, Title,
// Status, Checklist, Key Date, Links or a figure from a Sheet as it reads on the page, without its editing controls;
// and the quiet line a slot says while it is empty, loading or lost. Pure: markup at the slot's rect.
import {
  calendarDayAfter,
  daysUntil,
  svgWrapLines,
  type DashboardContent,
  type PlanPalette,
} from '@liveplanner/project';
import { relativeSince } from '@liveplanner/ui/relative-time';
import {
  FORM_METRIC_NAMES,
  SHEET_METRIC_NAMES,
  keyDateCount,
  linkLabelOf as labelOf,
  type SheetMetricShown,
} from './dashboard-card-values';
import { box, dot, line, type Rect } from './plan-art-kit';

const PAD = 16;

// The words a Status's state reads as, in its colour (DashboardStatusCard STATUS_INFO).
const STATUS_ART = {
  'on-track': { label: 'On Track', colour: '#10b981' },
  'at-risk': { label: 'At Risk', colour: '#f59e0b' },
  'off-track': { label: 'Off Track', colour: '#ef4444' },
} as const;
const PAST_RED = '#dc2626';
const DONE_GREEN = '#10b981';

// A figure from a Sheet, read now (plan-export-sheets.ts), or why it shows nothing.
export type SheetMetricArt = SheetMetricShown | 'cell-gone' | 'unset' | 'loading' | 'gone';

type CardArtInput = {
  rect: Rect;
  p: PlanPalette;
  now: Date;
  tabName: (id: string) => string | undefined;
  metric?: SheetMetricArt;
};

// Lines of text from the top of `r`, each paragraph wrapped to its width, as many lines as fit.
function paragraph(r: Rect, y: number, body: string, size: number, color: string, max: number) {
  const lineH = Math.round(size * 1.5);
  const room = Math.max(0, Math.min(max, Math.floor((r.y + r.height - PAD - y + size) / lineH)));
  const lines: string[] = [];
  for (const para of body.split('\n')) {
    if (lines.length >= room) break;
    const left = room - lines.length;
    lines.push(...(para.trim() ? svgWrapLines(para, r.width - PAD * 2, size, left) : ['']));
  }
  return lines
    .slice(0, room)
    .map((l, i) => (l ? line(r.x + PAD, y + i * lineH, l, { size, color }) : ''))
    .join('');
}

// A quiet line, centred in the slot: Empty Slot, Loading <name>…, This Board was deleted.
export function slotMessageArt(r: Rect, p: PlanPalette, message: string, strong = false): string {
  return line(r.x + r.width / 2, r.y + r.height / 2 + 5, message, {
    size: strong ? 14 : 13,
    weight: strong ? 600 : 400,
    color: strong ? p.text : p.muted,
    anchor: 'middle',
    width: r.width - PAD * 2,
  });
}

export function cardArt(content: DashboardContent, input: CardArtInput): string {
  const { rect: r, p } = input;
  switch (content.type) {
    case 'note':
      return (
        line(r.x + PAD, r.y + PAD + 14, content.title || 'Note', {
          size: 15,
          weight: 600,
          color: p.text,
          width: r.width - PAD * 2,
        }) + paragraph(r, r.y + PAD + 38, content.text, 13, p.muted, 40)
      );
    case 'title': {
      // A section's heading, sat at the slot's foot (22 px, 30 px once the slot is 448 px wide).
      const size = r.width >= 448 ? 30 : 22;
      const textSize = r.width >= 448 ? 15 : 14;
      const lines = content.text ? svgWrapLines(content.text, r.width - PAD * 2, textSize, 3) : [];
      const lineH = Math.round(textSize * 1.6);
      const base = r.y + r.height - 10 - lines.length * lineH;
      return (
        line(r.x + 8, base, content.title, {
          size,
          weight: 600,
          color: p.text,
          width: r.width - 16,
        }) +
        lines
          .map((l, i) =>
            line(r.x + 8, base + (i + 1) * lineH, l, { size: textSize, color: p.muted }),
          )
          .join('')
      );
    }
    case 'status': {
      const info = STATUS_ART[content.state];
      return (
        dot(r.x + PAD + 7, r.y + PAD + 9, 7, info.colour) +
        line(r.x + PAD + 22, r.y + PAD + 15, info.label, {
          size: 18,
          weight: 600,
          color: info.colour,
        }) +
        paragraph(r, r.y + PAD + 44, content.text, 13, p.text, 6) +
        (content.at
          ? line(
              r.x + PAD,
              r.y + r.height - PAD,
              `Updated ${relativeSince(content.at, input.now.getTime())}`,
              {
                size: 11,
                color: p.muted,
              },
            )
          : '')
      );
    }
    case 'checklist': {
      const done = content.items.filter((i) => i.done).length;
      const total = content.items.length;
      const parts = [
        line(r.x + PAD, r.y + PAD + 12, content.title || 'Checklist', {
          size: 14,
          weight: 600,
          color: p.text,
          width: r.width - PAD * 2 - 60,
        }),
        line(r.x + r.width - PAD, r.y + PAD + 12, `${done} of ${total}`, {
          size: 12,
          color: p.muted,
          anchor: 'end',
        }),
        box(
          { x: r.x + PAD, y: r.y + PAD + 22, width: r.width - PAD * 2, height: 4 },
          { fill: p.column, rx: 2 },
        ),
        box(
          {
            x: r.x + PAD,
            y: r.y + PAD + 22,
            width: total ? ((r.width - PAD * 2) * done) / total : 0,
            height: 4,
          },
          { fill: DONE_GREEN, rx: 2 },
        ),
      ];
      if (total === 0)
        return (
          parts.join('') +
          line(r.x + PAD, r.y + PAD + 52, 'Nothing on the list yet.', { size: 13, color: p.muted })
        );
      const rowH = 24;
      const room = Math.max(0, Math.floor((r.height - PAD * 2 - 36) / rowH));
      content.items.slice(0, room).forEach((it, i) => {
        const y = r.y + PAD + 38 + i * rowH;
        parts.push(
          box(
            { x: r.x + PAD, y, width: 14, height: 14 },
            it.done ? { fill: DONE_GREEN, rx: 4 } : { fill: p.surface, stroke: p.border, rx: 4 },
          ),
        );
        if (it.done)
          parts.push(
            `<path d="M${r.x + PAD + 3.5} ${y + 7.5}l2.5 2.5l4.5 -5" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
          );
        parts.push(
          line(r.x + PAD + 22, y + 11, it.text, {
            size: 13,
            color: it.done ? p.muted : p.text,
            width: r.width - PAD * 2 - 22,
            strike: it.done,
          }),
        );
      });
      return parts.join('');
    }
    case 'key-date': {
      const today = calendarDayAfter(input.now, 0);
      const days = daysUntil(content.date, today);
      const count = days === null ? null : keyDateCount(days);
      const head = line(r.x + PAD, r.y + PAD + 12, content.title || 'Key Date', {
        size: 14,
        weight: 600,
        color: p.text,
        width: r.width - PAD * 2,
      });
      if (!count)
        return (
          head +
          line(r.x + PAD, r.y + r.height / 2 + 8, 'No date set.', { size: 13, color: p.muted })
        );
      const y = r.y + r.height / 2 + 14;
      const shown = new Date(`${content.date}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      return (
        head +
        line(r.x + PAD, y, count.figure, {
          size: 34,
          weight: 600,
          color: count.past ? PAST_RED : p.text,
        }) +
        (count.unit
          ? line(r.x + PAD + count.figure.length * 34 * 0.6 + 8, y, count.unit, {
              size: 13,
              color: p.muted,
            })
          : '') +
        line(r.x + PAD, r.y + r.height - PAD, shown, { size: 12, color: p.muted })
      );
    }
    case 'links': {
      const parts = [
        line(r.x + PAD, r.y + PAD + 12, content.title || 'Links', {
          size: 14,
          weight: 600,
          color: p.text,
          width: r.width - PAD * 2,
        }),
      ];
      if (content.links.length === 0)
        return (
          parts.join('') +
          line(r.x + PAD, r.y + PAD + 44, 'No links yet.', { size: 13, color: p.muted })
        );
      const rowH = 24;
      const room = Math.max(0, Math.floor((r.height - PAD * 2 - 24) / rowH));
      content.links.slice(0, room).forEach((link, i) => {
        parts.push(
          line(r.x + PAD, r.y + PAD + 42 + i * rowH, labelOf(link, input.tabName), {
            size: 13,
            weight: 500,
            color: '#2563eb',
            width: r.width - PAD * 2,
          }),
        );
      });
      return parts.join('');
    }
    case 'sheet-metric':
      return sheetMetricArt(content.metric, input);
    // A figure from a form is read live from its link: an export names it.
    case 'form-metric':
      return slotMessageArt(r, p, FORM_METRIC_NAMES[content.metric], true);
    default:
      return '';
  }
}

// A figure from a Sheet: its name, the figure large, the line under it.
function sheetMetricArt(kind: keyof typeof SHEET_METRIC_NAMES, input: CardArtInput): string {
  const { rect: r, p, metric } = input;
  const name = SHEET_METRIC_NAMES[kind];
  if (!metric || metric === 'unset') return slotMessageArt(r, p, name, true);
  if (metric === 'loading') return slotMessageArt(r, p, 'Loading the sheet…');
  if (metric === 'gone') return slotMessageArt(r, p, 'This Sheet was deleted.');
  if (metric === 'cell-gone') return slotMessageArt(r, p, 'This cell was removed.');
  const hero = Math.max(22, Math.min(40, r.height / 3.4));
  const parts = [
    line(r.x + PAD, r.y + PAD + 12, metric.label, {
      size: 12,
      weight: 600,
      color: p.muted,
      width: r.width - PAD * 2,
    }),
    line(r.x + PAD, r.y + PAD + 18 + hero, metric.hero, {
      size: hero,
      weight: 700,
      color: p.text,
      width: r.width - PAD * 2,
    }),
    line(r.x + PAD, r.y + PAD + 40 + hero, metric.change?.text ?? metric.line, {
      size: 12,
      color:
        metric.change?.dir === 'up'
          ? DONE_GREEN
          : metric.change?.dir === 'down'
            ? PAST_RED
            : p.muted,
      width: r.width - PAD * 2,
    }),
  ];
  if (metric.progress) {
    const w = r.width - PAD * 2;
    const y = r.y + PAD + 54 + hero;
    parts.push(box({ x: r.x + PAD, y, width: w, height: 6 }, { fill: p.column, rx: 3 }));
    parts.push(
      box(
        { x: r.x + PAD, y, width: w * metric.progress.share, height: 6 },
        { fill: metric.progress.met ? DONE_GREEN : '#3b82f6', rx: 3 },
      ),
    );
  }
  return parts.join('');
}
