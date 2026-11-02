'use client';

// A field widget as drawn in the header (docs/specs/026-plan/board-widgets.md "Field widgets"): a 28px pill in the
// board's own colours, like every other widget, led by a picture of what its view reads, then the field's name and
// the figure. Its summary comes from fieldSummaryOf, one pass over the board's cards per field, kept until the cards,
// the field or the day change. A field gone from the board, or whose kind no longer fits the view, leaves a quiet,
// dashed pill with Remove for someone who may edit.
import {
  fieldWidgetState,
  parseFieldWidget,
  type BoardField,
  type CalculatedRead,
  type FieldWidgetKey,
  type FieldWidgetView,
  type Item,
  type PlanBoardSetup,
} from '@liveplanner/items';
import {
  fieldNumberText,
  fieldSummaryOf,
  fieldWidgetTitle,
  type CategorySummary,
  type DateSummary,
  type FieldSummary,
  type NumberSummary,
  type TickedSummary,
} from '@liveplanner/plan-art';
import { CloseIcon, CountBadge, Tooltip } from '@liveplanner/ui';
import { accentOn, type PlanPalette } from '../plan-palette';
import { FieldWidgetArt } from '../plan-tile-art';
import { choiceColour } from '../choice-options';
import { LABEL_COLOURS, labelColour } from '../label-colour';
import { OVERDUE_RED, PHASE_COLOURS } from '../views/view-frame';
import { MiniBars, Ring, SplitBar, Stars, type Segment } from './field-widget-charts';
import { WIDGET_PILL } from './BoardWidgetView';

const DONE_GREEN = PHASE_COLOURS.done;
const SOON_AMBER = '#d97706';
const STAR_GOLD = '#f59e0b';
// How many values a Breakdown names after its bar.
const BREAKDOWN_NAMED = 2;

export type FieldWidgetContext = {
  // The fields the board's widgets can read (boardFields), memoised on the board's set-up and types.
  fields: readonly BoardField[];
  // The cards the board shows, before its quick filter (memoised by the board, so summaries are kept per list).
  items: readonly Item[];
  setup: PlanBoardSetup;
  palette: PlanPalette;
  now: Date;
  read?: CalculatedRead | undefined;
  canEdit: boolean;
  onRemove: (id: FieldWidgetKey) => void;
};

// A category value's colour: a Choice option's, a label's, a person's own, else the label swatches in turn.
function valueColour(
  summary: CategorySummary,
  field: BoardField,
  key: string,
  index: number,
  own: string | undefined,
): string {
  const fallback = LABEL_COLOURS[index % LABEL_COLOURS.length]!;
  switch (summary.from) {
    case 'choice':
    case 'multichoice':
      return choiceColour(field.def.options ?? [], key) ?? fallback;
    case 'labels':
      return labelColour(key);
    case 'person':
      return own ?? fallback;
    default:
      return fallback;
  }
}

function segmentsOf(summary: CategorySummary, field: BoardField, palette: PlanPalette): Segment[] {
  const total = summary.values.reduce((n, v) => n + v.count, 0);
  return summary.values.map((v, i) => ({
    key: v.key,
    share: total ? v.count / total : 0,
    color: accentOn(valueColour(summary, field, v.key, i, v.color), palette),
  }));
}

export function FieldWidgetView({ id, ctx }: { id: FieldWidgetKey; ctx: FieldWidgetContext }) {
  const { palette } = ctx;
  const state = fieldWidgetState(id, ctx.fields);
  if (state.state !== 'ok')
    return (
      <span
        data-field-widget-gone=""
        className={`${WIDGET_PILL} border-dashed`}
        style={{ borderColor: palette.border, color: palette.muted }}
      >
        <span className="flex shrink-0" aria-hidden>
          <FieldWidgetArt view={parseFieldWidget(id)!.view} size={14} />
        </span>
        {state.state === 'removed' ? 'This field was removed' : 'This field changed kind'}
        {ctx.canEdit ? (
          <button
            type="button"
            aria-label="Remove widget"
            className="-mr-1 flex h-5 cursor-pointer items-center gap-1 rounded px-1 transition hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: palette.text }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              ctx.onRemove(id);
            }}
          >
            <CloseIcon size={9} />
            Remove
          </button>
        ) : null}
      </span>
    );
  const { field, view } = state;
  const summary = fieldSummaryOf(field, ctx.items, {
    setup: ctx.setup,
    now: ctx.now,
    read: ctx.read,
  });
  const title = fieldWidgetTitle(field, view);
  return <FieldPill view={view} field={field} summary={summary} title={title} palette={palette} />;
}

// The pill for a field that reads: its picture, name and figure, or "no values yet".
function FieldPill({
  view,
  field,
  summary,
  title,
  palette,
}: {
  view: FieldWidgetView;
  field: BoardField;
  summary: FieldSummary | undefined;
  title: string;
  palette: PlanPalette;
}) {
  const pill = { borderColor: palette.border, color: palette.muted };
  const name = <span className="max-w-[9rem] truncate">{field.def.label}</span>;
  const strong = (text: string) => (
    <strong className="font-semibold tabular-nums" style={{ color: palette.text }}>
      {text}
    </strong>
  );
  const lead = (color: string) => (
    <span className="flex shrink-0" style={{ color }} aria-hidden>
      <FieldWidgetArt view={view} size={14} />
    </span>
  );
  const shell = (spoken: string, children: React.ReactNode, extra = '') => (
    <Tooltip label={title}>
      <span
        data-field-widget={view}
        className={`${WIDGET_PILL} ${extra}`}
        style={pill}
        role="img"
        aria-label={`${title}: ${spoken}`}
      >
        {children}
      </span>
    </Tooltip>
  );
  if (!summary || summary.filled === 0)
    return shell(
      'no values yet',
      <>
        {lead(palette.muted)}
        {name}
        <span>: no values yet</span>
      </>,
    );
  switch (summary.shape) {
    case 'number':
      return numberPill(view, summary, { name, strong, lead, shell, palette });
    case 'category':
      return categoryPill(view, summary, field, { name, strong, lead, shell, palette });
    case 'ticked':
      return tickedPill(summary, { name, strong, shell, palette });
    case 'date':
      return datePill(view, summary, { name, strong, lead, shell, palette });
  }
}

type Parts = {
  name: React.ReactNode;
  strong: (text: string) => React.ReactNode;
  lead: (color: string) => React.ReactNode;
  shell: (spoken: string, children: React.ReactNode, extra?: string) => React.ReactNode;
  palette: PlanPalette;
};

function numberPill(view: FieldWidgetView, s: NumberSummary, p: Parts) {
  const text = (n: number) => fieldNumberText(s, n);
  const cards = `${s.filled} ${s.filled === 1 ? 'card' : 'cards'}`;
  const average = s.sum / s.filled;
  switch (view) {
    case 'sum':
      return p.shell(
        `${text(s.sum)} over ${cards}`,
        <>
          {p.lead(p.palette.focus)}
          {p.name}
          {p.strong(text(s.sum))}
        </>,
      );
    case 'average':
      return p.shell(
        `average ${text(average)} over ${cards}`,
        <>
          {p.lead(p.palette.focus)}
          {p.name}
          <span>avg</span>
          {p.strong(text(average))}
        </>,
      );
    case 'range':
      return p.shell(
        `${text(s.min)} to ${text(s.max)}`,
        <>
          {p.lead(p.palette.focus)}
          {p.name}
          {p.strong(text(s.min))}
          <span>to</span>
          {p.strong(text(s.max))}
        </>,
      );
    case 'stars': {
      const scale = s.scale ?? 5;
      const figure = scale > 5 ? `${average.toFixed(1)} / ${scale}` : average.toFixed(1);
      return p.shell(
        `average ${average.toFixed(1)} of ${scale} over ${cards}`,
        <>
          {p.name}
          <Stars value={average} scale={scale} color={STAR_GOLD} palette={p.palette} />
          {p.strong(figure)}
        </>,
      );
    }
    default:
      // Spread: how many cards in each eighth of the range.
      return p.shell(
        `${cards} from ${text(s.min)} to ${text(s.max)}`,
        <>
          <MiniBars counts={s.bins} color={p.palette.focus} palette={p.palette} />
          {p.name}
          <CountBadge size="md" background={p.palette.column} color={p.palette.text}>
            {s.filled}
          </CountBadge>
        </>,
      );
  }
}

function categoryPill(view: FieldWidgetView, s: CategorySummary, field: BoardField, p: Parts) {
  const segments = segmentsOf(s, field, p.palette);
  const spoken = s.values.map((v) => `${v.count} ${v.label}`).join(', ');
  const top = s.values[0]!;
  if (view === 'donut') {
    const share = Math.round(segments[0]!.share * 100);
    return p.shell(
      `${top.label} ${share}%; ${spoken}`,
      <>
        <Ring segments={segments} palette={p.palette} />
        {p.name}
        <span className="max-w-[7rem] truncate" style={{ color: p.palette.text }}>
          {top.label}
        </span>
        {p.strong(`${share}%`)}
      </>,
      'pl-1.5',
    );
  }
  const named = s.values.slice(0, BREAKDOWN_NAMED);
  const rest = s.values.length - named.length;
  return p.shell(
    spoken,
    <>
      {p.name}
      <SplitBar segments={segments} palette={p.palette} width={48} />
      {named.map((v, i) => (
        <span key={v.key} className="inline-flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: segments[i]!.color }}
          />
          <span className="max-w-[6rem] truncate">{v.label}</span>
          <CountBadge size="md" background={p.palette.column} color={p.palette.text}>
            {v.count}
          </CountBadge>
        </span>
      ))}
      {rest > 0 ? <span>+{rest}</span> : null}
    </>,
    'gap-2',
  );
}

function tickedPill(s: TickedSummary, p: Omit<Parts, 'lead'>) {
  const share = s.total ? s.ticked / s.total : 0;
  return p.shell(
    `${s.ticked} of ${s.total} ticked`,
    <>
      <Ring segments={[{ key: 'ticked', share, color: DONE_GREEN }]} palette={p.palette} />
      {p.name}
      {p.strong(`${s.ticked}/${s.total}`)}
    </>,
    'pl-1.5',
  );
}

function datePill(view: FieldWidgetView, s: DateSummary, p: Parts) {
  if (view === 'timeline') {
    const colors = [OVERDUE_RED, SOON_AMBER, p.palette.focus, p.palette.focus, p.palette.focus];
    return p.shell(
      `${s.overdue} overdue, ${s.ahead} due in the next four weeks`,
      <>
        <MiniBars counts={s.weeks} color={p.palette.focus} colors={colors} palette={p.palette} />
        {p.name}
        {p.strong(String(s.ahead))}
        <span>in 4 wks</span>
      </>,
    );
  }
  if (s.overdue === 0 && s.soon === 0)
    return p.shell(
      'nothing due',
      <>
        {p.lead(DONE_GREEN)}
        {p.name}
        <span>Nothing due</span>
      </>,
    );
  return p.shell(
    `${s.overdue} overdue, ${s.soon} due soon`,
    <>
      {p.lead(s.overdue > 0 ? OVERDUE_RED : SOON_AMBER)}
      {p.name}
      {s.overdue > 0 ? (
        <span className="inline-flex items-center gap-1">
          <CountBadge size="md" background={`${OVERDUE_RED}26`} color={OVERDUE_RED}>
            {s.overdue}
          </CountBadge>
          overdue
        </span>
      ) : null}
      {s.soon > 0 ? (
        <span className="inline-flex items-center gap-1">
          <CountBadge size="md" background={`${SOON_AMBER}26`} color={SOON_AMBER}>
            {s.soon}
          </CountBadge>
          soon
        </span>
      ) : null}
    </>,
    'gap-2',
  );
}
