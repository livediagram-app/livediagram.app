// The little picture on a tab tile (docs/specs/026-plan/plan-overview.md "Tabs"): drawn from TabTilePicture's data
// with plain boxes, no canvas and no SVG filters, so a grid of them costs a few dozen elements each.
import type { TabTilePicture as Picture } from './overview-tabs';

// Each kind's wash behind its picture, light and dark.
const WASH: Record<Picture['kind'], string> = {
  board: 'bg-teal-50 dark:bg-teal-950/50',
  bars: 'bg-indigo-50 dark:bg-indigo-950/40',
  sheet: 'bg-sky-50 dark:bg-sky-950/40',
  dashboard: 'bg-amber-50 dark:bg-amber-950/30',
  form: 'bg-pink-50 dark:bg-pink-950/30',
  empty: 'bg-slate-50 dark:bg-slate-900',
  loading: 'bg-slate-100 dark:bg-slate-800',
};

// A box on the wash: white on light, a lift of the dark surface on dark.
const BOX =
  'rounded bg-white/90 shadow-[0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-white/[0.07] dark:shadow-none';

function Board({ columns }: { columns: Extract<Picture, { kind: 'board' }>['columns'] }) {
  return (
    <div
      className="grid h-full gap-1.5"
      style={{ gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` }}
    >
      {columns.map((col) => (
        <div key={col.id} className={`flex min-w-0 flex-col gap-1 p-1 ${BOX}`}>
          <span className="h-[3px] rounded-full bg-teal-500/60 dark:bg-teal-400/50" />
          {col.cards.map((card) => (
            <span
              key={card.id}
              className="h-3 rounded-[3px] border-l-2 bg-slate-100 dark:bg-white/[0.12]"
              style={{ borderLeftColor: card.colour }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Bars({ bars }: { bars: Extract<Picture, { kind: 'bars' }>['bars'] }) {
  return (
    <div className="flex h-full flex-col justify-center gap-2 px-1">
      {bars.length === 0 ? (
        <span className="h-2 w-1/3 rounded-full bg-slate-300/60 dark:bg-white/10" />
      ) : (
        bars.map((bar) => (
          <span
            key={bar.id}
            className="h-2 rounded-full opacity-90"
            style={{
              background: bar.colour,
              marginLeft: `${Math.round(bar.x * 100)}%`,
              width: `${Math.round(Math.min(bar.w, 1 - bar.x) * 100)}%`,
            }}
          />
        ))
      )}
    </div>
  );
}

const SHEET_ROWS = 5;
const SHEET_COLS = 5;
function Sheet() {
  const cells = [];
  for (let r = 0; r < SHEET_ROWS; r++)
    for (let c = 0; c < SHEET_COLS; c++)
      cells.push(
        <span
          key={`${r}:${c}`}
          className={`rounded-[1px] ${
            r === 0
              ? 'bg-sky-400/50 dark:bg-sky-400/40'
              : c === 0
                ? 'bg-slate-300/80 dark:bg-white/25'
                : 'bg-white dark:bg-white/[0.12]'
          }`}
        />,
      );
  return (
    <div
      className="grid h-full gap-0.5"
      style={{ gridTemplateColumns: '18px repeat(4, minmax(0, 1fr))', gridAutoRows: '1fr' }}
    >
      {cells}
    </div>
  );
}

function Dashboard({ rows }: { rows: Extract<Picture, { kind: 'dashboard' }>['rows'] }) {
  return (
    <div className="flex h-full flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.id} className="grid min-h-0 flex-1 grid-cols-12 gap-1.5">
          {row.slots.map((slot) => (
            <span
              key={slot.id}
              className={
                slot.filled
                  ? `${BOX} border-t-2 border-amber-400/80 dark:border-amber-300/60`
                  : 'rounded border border-dashed border-amber-300/70 dark:border-amber-200/20'
              }
              style={{ gridColumn: `span ${Math.min(12, Math.max(1, slot.span))}` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function Form({ fields }: { fields: number }) {
  return (
    <div className="flex h-full flex-col justify-center gap-1.5 px-4">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <span className="h-1.5 w-2/5 rounded-full bg-slate-400/60 dark:bg-white/40" />
          <span className="h-3.5 rounded border border-slate-300 bg-white dark:border-white/20 dark:bg-transparent" />
        </div>
      ))}
      <span className="h-3.5 w-12 self-end rounded bg-pink-500/80 dark:bg-pink-400/70" />
    </div>
  );
}

export function TabTilePicture({ picture }: { picture: Picture }) {
  let body = null;
  switch (picture.kind) {
    case 'board':
      body = <Board columns={picture.columns} />;
      break;
    case 'bars':
      body = <Bars bars={picture.bars} />;
      break;
    case 'sheet':
      body = <Sheet />;
      break;
    case 'dashboard':
      body = <Dashboard rows={picture.rows} />;
      break;
    case 'form':
      body = <Form fields={picture.fields} />;
      break;
    case 'empty':
      body = (
        <span className="block h-full rounded-md border border-dashed border-slate-300 dark:border-slate-700" />
      );
      break;
    case 'loading':
      body = null;
      break;
  }
  return (
    <div
      aria-hidden
      data-tile-picture={picture.kind}
      className={`h-[104px] p-2.5 ${WASH[picture.kind]} ${picture.kind === 'loading' ? 'motion-safe:animate-pulse' : ''}`}
    >
      {body}
    </div>
  );
}
