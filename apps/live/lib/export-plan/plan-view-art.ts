// A plan view's still picture in an image export (docs/specs/026-plan/plan-tabs.md "Export"): the chart the live
// view draws, from the same models, at the element's box, in the board's palette. The editor hands it to the SVG
// renderer as `resolvePlanArt`; outside the editor a plan view stays a labelled box. Pure.
import {
  planOwnColoursOf,
  planPalette,
  type CanvasSurface,
  type PlanPalette,
  type PlanViewRef,
  type ShapeElement,
} from '@livediagram/document';
import {
  PLAN_VISUALISATION_LABELS,
  PRIORITY_LABELS,
  STATUS_PHASES,
  STATUS_PHASE_LABELS,
  breakdownGroupingOf,
  breakdownModel,
  cardsInStatuses,
  itemTitle,
  metricBoard,
  planViewMetric,
  priorityMatrixModel,
  readPlanViewSettings,
  searchCards,
  statusMixModel,
  typeIn,
  viewShownTypes,
  type Item,
  type ItemTypeDef,
  type MetricKind,
  type PlanViewId,
  type StatusPhase,
} from '@livediagram/items';
import { BOARD_WIDGET_INFO } from '@/components/plan/board-widget-catalogue';
import { metricModel } from '@/components/plan/views/metric-tile-model';
import { PHASE_COLOURS } from '@/components/plan/views/phase-colours';
import { PRIORITY_COLOURS } from '@livediagram/document';
import { mixHex } from '@livediagram/document';
import {
  ART_PAD,
  box,
  dot,
  emptyBody,
  inPlanFont,
  line,
  viewFrame,
  type Rect,
} from './plan-art-kit';
import { calendarArt, ganttArt } from './plan-view-time-art';

// What a picture reads: the document's cards and how its boards name and place their statuses.
export type PlanArtData = {
  items: ReadonlyMap<string, Item>;
  types: readonly ItemTypeDef[];
  statusPhases: ReadonlyMap<string, StatusPhase>;
  statusNames: ReadonlyMap<string, string>;
  // One clock for the whole export.
  now: Date;
  // The tab theme's categorical colours (Status Breakdown's slices).
  chartPalette: readonly string[];
};

export type ViewArtInput = {
  rect: Rect;
  p: PlanPalette;
  items: ReadonlyMap<string, Item>;
  data: PlanArtData;
  settings: PlanViewRef;
  title?: string;
};

// The view's own title in place of its name ("Launch Plan"), as the live header shows it.
const titled = (name: string, own: string | undefined) => own?.trim() || name;

export function planViewArt(el: ShapeElement, data: PlanArtData, surface: CanvasSurface): string {
  const p = planPalette(surface, planOwnColoursOf(el));
  const view: PlanViewId = el.planView?.view ?? 'workload';
  const settings: PlanViewRef = el.planView ? readPlanViewSettings(el.planView) : { view };
  // The cards of the types the view shows (PlanViewView); a Gantt picks its own.
  let items = data.items;
  if (view !== 'gantt') {
    const shown = new Set(viewShownTypes(view, { types: el.planView?.types }, data.types));
    if (!(shown.size === data.types.length && data.types.every((t) => shown.has(t.id))))
      items = new Map([...items].filter(([, it]) => shown.has(it.type)));
  }
  const input: ViewArtInput = {
    rect: { x: el.x, y: el.y, width: el.width, height: el.height },
    p,
    items,
    data,
    settings,
    ...(el.planView?.title ? { title: el.planView.title } : {}),
  };
  const metric = planViewMetric(view);
  if (metric) return inPlanFont(metricArt(metric, input));
  switch (view) {
    case 'gantt':
      return inPlanFont(ganttArt(input));
    case 'calendar':
    case 'start-calendar':
      return inPlanFont(calendarArt(input, view === 'start-calendar' ? 'start' : 'due'));
    case 'workload':
      return inPlanFont(workloadArt(input));
    case 'priority-matrix':
      return inPlanFont(matrixArt(input));
    case 'search':
      return inPlanFont(searchArt(input));
    default:
      return inPlanFont(statusMixArt(input));
  }
}

// The phase key, top right of a body (PhaseLegend).
function phaseLegend(body: Rect, p: PlanPalette): string {
  const parts: string[] = [];
  let x = body.x + body.width - ART_PAD;
  for (const phase of [...STATUS_PHASES].reverse()) {
    const label = STATUS_PHASE_LABELS[phase];
    const w = label.length * 11 * 0.6;
    parts.push(line(x, body.y + 20, label, { size: 11, color: p.muted, anchor: 'end' }));
    x -= w + 8;
    parts.push(dot(x, body.y + 16, 4, PHASE_COLOURS[phase]));
    x -= 16;
  }
  return parts.join('');
}

// Cards by Field: a bar a row, split by phase, its total after it.
function workloadArt({ rect, p, items, data, settings, title }: ViewArtInput): string {
  const { by, field } = breakdownGroupingOf(settings);
  const counted = cardsInStatuses(items, settings.statuses);
  const model = breakdownModel(
    counted.values(),
    data.statusPhases,
    { by, field },
    data.types,
    data.statusNames,
  );
  const frame = viewFrame(rect, p, titled(PLAN_VISUALISATION_LABELS.workload, title), model.total);
  if (model.total === 0) return frame.markup + emptyBody(frame.body, p, 'No cards yet.');
  const body = frame.body;
  const top = body.y + 32;
  const rows = model.rows;
  const rowH = Math.max(
    18,
    Math.min(48, (body.y + body.height - ART_PAD - top) / Math.max(1, rows.length)),
  );
  const shown = rows.slice(
    0,
    Math.max(1, Math.floor((body.y + body.height - ART_PAD - top) / rowH)),
  );
  const labelW = Math.min(180, body.width * 0.3);
  const barX = body.x + ART_PAD + labelW + 12;
  const barMax = Math.max(0, body.x + body.width - ART_PAD - 32 - barX);
  const barH = Math.max(8, Math.min(28, rowH * 0.6));
  const parts = [frame.markup, phaseLegend(body, p)];
  shown.forEach((row, i) => {
    const cy = top + i * rowH + rowH / 2;
    parts.push(
      line(body.x + ART_PAD, cy + 4, row.label, {
        size: 12,
        color: row.empty ? p.muted : p.text,
        width: labelW,
      }),
    );
    let x = barX;
    const w = model.max ? (row.total / model.max) * barMax : 0;
    for (const phase of STATUS_PHASES) {
      const n = row.counts[phase];
      if (!n) continue;
      const part = (n / row.total) * w;
      parts.push(
        box(
          { x, y: cy - barH / 2, width: part, height: barH },
          { fill: PHASE_COLOURS[phase], rx: 3 },
        ),
      );
      x += part;
    }
    parts.push(line(x + 8, cy + 4, String(row.total), { size: 12, weight: 600, color: p.muted }));
  });
  return parts.join('');
}

// Priority by Status: a grid of counts, each cell tinted by its share.
function matrixArt({ rect, p, items, data, settings, title }: ViewArtInput): string {
  const counted = cardsInStatuses(items, settings.statuses);
  const model = priorityMatrixModel(counted.values(), data.statusPhases);
  const frame = viewFrame(rect, p, titled('Priority by Status', title), model.total);
  if (model.total === 0) return frame.markup + emptyBody(frame.body, p, 'No cards yet.');
  const body = frame.body;
  const gap = 6;
  const labelW = Math.min(120, body.width * 0.28);
  const headH = 22;
  const gridX = body.x + ART_PAD + labelW + gap;
  const cellW = (body.x + body.width - ART_PAD - gridX - gap * 2) / 3;
  const top = body.y + ART_PAD + headH;
  const cellH =
    (body.y + body.height - ART_PAD - top - gap * (model.rows.length - 1)) / model.rows.length;
  const parts = [frame.markup];
  STATUS_PHASES.forEach((phase, c) => {
    const cx = gridX + c * (cellW + gap) + cellW / 2;
    parts.push(
      line(cx, body.y + ART_PAD + 12, STATUS_PHASE_LABELS[phase], {
        size: 11,
        weight: 600,
        color: p.muted,
        anchor: 'middle',
        width: cellW,
      }),
    );
  });
  model.rows.forEach((row, r) => {
    const y = top + r * (cellH + gap);
    const label = row.priority ? PRIORITY_LABELS[row.priority] : 'No Priority';
    const tint = row.priority ? PRIORITY_COLOURS[row.priority] : p.muted;
    parts.push(
      box(
        { x: body.x + ART_PAD, y: y + cellH / 2 - 4, width: 8, height: 8 },
        { fill: tint, rx: 2 },
      ),
    );
    parts.push(
      line(body.x + ART_PAD + 14, y + cellH / 2 + 4, label, {
        size: 12,
        color: row.priority ? p.text : p.muted,
        width: labelW - 14,
      }),
    );
    STATUS_PHASES.forEach((phase, c) => {
      const n = row.counts[phase];
      const share = model.max ? n / model.max : 0;
      const x = gridX + c * (cellW + gap);
      const fill = n ? mixHex(tint, p.surface, 0.12 + share * 0.48) : p.column;
      parts.push(box({ x, y, width: cellW, height: cellH }, { fill, rx: 6 }));
      if (n)
        parts.push(
          line(x + cellW / 2, y + cellH / 2 + 5, String(n), {
            size: Math.max(11, Math.min(20, cellH / 2.4)),
            weight: 600,
            color: p.text,
            anchor: 'middle',
          }),
        );
    });
  });
  return parts.join('');
}

// Status Breakdown: one bar split by status, its legend under it.
function statusMixArt({ rect, p, items, data, title }: ViewArtInput): string {
  const model = statusMixModel(items.values(), data.statusNames);
  const frame = viewFrame(rect, p, titled('Status Breakdown', title), model.total);
  if (model.total === 0) return frame.markup + emptyBody(frame.body, p, 'No cards yet.');
  const body = frame.body;
  const colours = model.slices.map((s, i) =>
    s.status === null ? p.muted : data.chartPalette[i % data.chartPalette.length]!,
  );
  const parts = [frame.markup];
  const barW = body.width - ART_PAD * 2;
  let x = body.x + ART_PAD;
  model.slices.forEach((s, i) => {
    const w = (s.count / model.total) * barW;
    parts.push(box({ x, y: body.y + ART_PAD, width: w, height: 18 }, { fill: colours[i]!, rx: 3 }));
    x += w;
  });
  const rowH = 20;
  const room = Math.max(1, Math.floor((body.height - ART_PAD * 2 - 30) / rowH));
  model.slices.slice(0, room).forEach((s, i) => {
    const y = body.y + ART_PAD + 30 + i * rowH;
    parts.push(dot(body.x + ART_PAD + 5, y + 6, 5, colours[i]!));
    parts.push(
      line(body.x + ART_PAD + 16, y + 10, s.label, { size: 12, color: p.text, width: barW - 60 }),
    );
    parts.push(
      line(body.x + body.width - ART_PAD, y + 10, String(s.count), {
        size: 12,
        weight: 600,
        color: p.muted,
        anchor: 'end',
      }),
    );
  });
  return parts.join('');
}

// Card Search: the matching cards, a row each (their number, type and title), as many as fit.
function searchArt({ rect, p, items, data, settings, title }: ViewArtInput): string {
  const cards = searchCards(items.values(), settings.filters ?? [], data.types, data.statusNames);
  const frame = viewFrame(rect, p, titled('Card Search', title), cards.length);
  if (cards.length === 0) return frame.markup + emptyBody(frame.body, p, 'No cards match.');
  return frame.markup + cardRows(frame.body, p, cards, data.types);
}

// Cards as rows of a list: a type stripe, `#12 · Task`, the title.
function cardRows(
  body: Rect,
  p: PlanPalette,
  cards: readonly Item[],
  types: readonly ItemTypeDef[],
): string {
  const rowH = 30;
  const room = Math.max(0, Math.floor((body.height - ART_PAD) / (rowH + 6)));
  const parts: string[] = [];
  cards.slice(0, room).forEach((it, i) => {
    const y = body.y + ART_PAD + i * (rowH + 6);
    const type = typeIn(types, it.type);
    const w = body.width - ART_PAD * 2;
    parts.push(
      box(
        { x: body.x + ART_PAD, y, width: w, height: rowH },
        { fill: p.card, stroke: p.cardBorder, rx: 6 },
      ),
    );
    parts.push(
      box({ x: body.x + ART_PAD, y, width: 4, height: rowH }, { fill: type.color, rx: 2 }),
    );
    const tag = `#${it.key}`;
    parts.push(line(body.x + ART_PAD + 12, y + 19, tag, { size: 11, color: p.muted }));
    parts.push(
      line(body.x + ART_PAD + 20 + tag.length * 7, y + 19, itemTitle(it).trim() || 'Untitled', {
        size: 12,
        weight: 600,
        color: p.text,
        width: w - 32 - tag.length * 7,
      }),
    );
  });
  return parts.join('');
}

// A metric tile: its name, the figure (and its unit), the line under it, and its bars where it has them.
function metricArt(kind: MetricKind, { rect, p, items, data }: ViewArtInput): string {
  const board = metricBoard(items.values(), data.statusPhases, data.types);
  const model = metricModel(kind, board, data.types, data.now);
  const parts = [box(rect, { fill: p.surface, stroke: p.border, rx: 12 })];
  const label = BOARD_WIDGET_INFO[kind].label;
  const inner = rect.width - ART_PAD * 2;
  const compact = rect.height < 110;
  const hero = Math.max(18, Math.min(48, rect.height / (compact ? 2.2 : 3.2)));
  parts.push(
    line(rect.x + ART_PAD, rect.y + 22, label, {
      size: 12,
      weight: 600,
      color: p.muted,
      width: inner,
    }),
  );
  const heroY = compact ? rect.y + rect.height - 12 : rect.y + 30 + hero;
  parts.push(
    line(rect.x + ART_PAD, heroY, model.hero, {
      size: hero,
      weight: 700,
      color: model.tone ?? p.text,
    }),
  );
  const after = rect.x + ART_PAD + model.hero.length * hero * 0.6 + 8;
  if (model.unit) parts.push(line(after, heroY, model.unit, { size: 13, color: p.muted }));
  if (!compact) {
    parts.push(
      line(rect.x + ART_PAD, heroY + 20, model.line, { size: 12, color: p.muted, width: inner }),
    );
    const visual = model.visual;
    const bars =
      visual?.kind === 'bars' ? visual.rows : visual?.kind === 'split' ? visual.parts : null;
    const total = visual && 'total' in visual ? visual.total : 0;
    if (bars && total && rect.height - (heroY + 36 - rect.y) > 14) {
      let x = rect.x + ART_PAD;
      const y = heroY + 34;
      for (const b of bars) {
        const w = (b.count / total) * inner;
        parts.push(box({ x, y, width: w, height: 8 }, { fill: b.color, rx: 2 }));
        x += w;
      }
    } else if (visual?.kind === 'ring' && rect.height - (heroY + 36 - rect.y) > 14) {
      const y = heroY + 34;
      parts.push(
        box({ x: rect.x + ART_PAD, y, width: inner, height: 8 }, { fill: p.column, rx: 4 }),
      );
      parts.push(
        box(
          { x: rect.x + ART_PAD, y, width: (inner * visual.pct) / 100, height: 8 },
          { fill: PHASE_COLOURS.done, rx: 4 },
        ),
      );
    }
  }
  return parts.join('');
}
