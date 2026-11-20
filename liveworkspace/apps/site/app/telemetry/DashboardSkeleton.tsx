import { WINDOW_META } from './_shared/windows';

// What the dashboard shows while its numbers load (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard",
// Loading): the shapes the data will take, in the layout it will take, so the page never empties and
// nothing above the cards moves when the data lands. Static markup: no state, no effects, no requests.
// The pulse is the site's skeleton tone and stops under reduced motion.

const PULSE = 'animate-pulse bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70';
const CARD = 'rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';
// A placeholder for one line of text: the block keeps the text's line height (its `text` classes), so
// the skeleton stands exactly as tall as the words it stands in for.
function Bone({
  text,
  width,
  className = '',
}: {
  text: string;
  width: string;
  className?: string;
}) {
  return (
    <span className={`block ${text} ${className}`}>
      <span
        className={`inline-block h-[0.7em] max-w-full align-middle rounded ${width} ${PULSE}`}
      />
    </span>
  );
}

// WindowPanel's shape: the three window tiles, then the 30-day trend chart.
function WindowPanelSkeleton() {
  return (
    <div className={`${CARD} p-5`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {WINDOW_META.map((w) => (
          <div key={w.key} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <Bone text="text-[10px]" width="w-20" />
            <Bone text="text-2xl" width="w-16" className="mt-1" />
            <Bone text="text-xs" width="w-28" className="mt-0.5" />
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
        <div className="flex items-baseline justify-between">
          <Bone text="text-sm" width="w-56" />
          <Bone text="text-xs" width="w-28" />
        </div>
        <div className={`mt-4 h-40 rounded-xl ${PULSE}`} />
        {/* TrendChart's axis: first day, peak and average, last day. */}
        <div className="mt-2 flex justify-between">
          <Bone text="text-[10px]" width="w-10" />
          <Bone text="text-[10px]" width="w-24" />
          <Bone text="text-[10px]" width="w-10" />
        </div>
      </div>
    </div>
  );
}

// MetricCard's shape: icon, title and event, the count, a two-line blurb, the trend line.
function MetricCardSkeleton() {
  return (
    <div className={`flex h-full flex-col p-5 ${CARD}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className={`mt-0.5 h-8 w-8 shrink-0 rounded-lg ${PULSE}`} />
          <div className="min-w-0 flex-1">
            <Bone text="text-sm" width="w-28" />
            <Bone text="text-xs" width="w-36" />
          </div>
        </div>
        <Bone text="text-2xl" width="w-12" />
      </div>
      <Bone text="text-xs leading-relaxed" width="w-full" className="mt-3" />
      <Bone text="text-xs leading-relaxed" width="w-3/4" />
      <div className="mt-auto pt-4">
        <div className={`h-20 rounded-lg ${PULSE}`} />
      </div>
    </div>
  );
}

const TAB_BAR =
  'flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900';
const TAB = 'h-8 shrink-0 rounded-lg pointer-coarse:h-10';

// What differs between the two dashboards while they load: how many tabs lead the row and sit in the Detail bar,
// and the card groups the Dashboard tab opens on (a first row of key numbers, then a chart group; for All Apps,
// At a Glance and a card an app).
const SHAPES = {
  all: { leads: ['w-8 sm:w-28'], detail: ['w-32', 'w-40', 'w-28', 'w-32', 'w-32'], groups: [6, 5] },
  app: {
    leads: ['w-8 sm:w-28', 'w-8 sm:w-20'],
    detail: ['w-20', 'w-20', 'w-20', 'w-28', 'w-24', 'w-28', 'w-28', 'w-28', 'w-20', 'w-16'],
    groups: [6, 3],
  },
};

// Either dashboard: the panel, the tab row, and the Dashboard tab's groups of metric cards.
function Skeleton({ variant }: { variant: 'all' | 'app' }) {
  const shape = SHAPES[variant];
  return (
    <>
      <div className="mt-10">
        <WindowPanelSkeleton />
      </div>
      {/* ViewTabs' two bars (Dashboard and Search, then the Detail tabs), their tabs as placeholders
          the height of a tab. */}
      <div className="mt-8 flex items-start gap-3">
        <div className={`${TAB_BAR} shrink-0`}>
          {shape.leads.map((width, i) => (
            <span key={i} className={`${TAB} ${width} ${PULSE}`} />
          ))}
        </div>
        <div className={`${TAB_BAR} min-w-0 flex-1 overflow-hidden sm:flex-wrap`}>
          {shape.detail.map((width, i) => (
            <span key={i} className={`${TAB} ${width} ${PULSE}`} />
          ))}
        </div>
      </div>
      <div className="mt-8">
        <Bone text="text-sm" width="w-full max-w-xl" />
        <div className="mt-6 flex flex-col gap-8">
          {shape.groups.map((size, g) => (
            <section key={g}>
              <Bone text="text-xs" width="w-28" />
              <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: size }, (_, i) => (
                  <MetricCardSkeleton key={i} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

export function DashboardSkeleton({ variant }: { variant: 'all' | 'app' }) {
  return (
    <div aria-busy="true" data-testid="telemetry-skeleton">
      <p role="status" className="sr-only">
        Loading the numbers…
      </p>
      <div aria-hidden>
        <Skeleton variant={variant} />
      </div>
    </div>
  );
}
