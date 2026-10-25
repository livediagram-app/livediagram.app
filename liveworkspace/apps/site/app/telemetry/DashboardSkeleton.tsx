import { TELEMETRY_APPS } from '@liveworkspace/telemetry';
import { WINDOW_META } from './_shared/windows';

// What the dashboard shows while its numbers load (liveworkspace/docs/telemetry.md "The dashboard",
// Loading): the shapes the data will take, in the layout it will take, so the page never empties and
// nothing above the cards moves when the data lands. Static markup: no state, no effects, no requests.
// The pulse is the site's skeleton tone and stops under reduced motion.

const PULSE = 'animate-pulse bg-slate-200/70 motion-reduce:animate-none dark:bg-slate-800/70';
const CARD = 'rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';
// The window "All apps" opens on (AllApps' and AppDashboard's first state).
const FIRST_WINDOW = WINDOW_META.find((w) => w.key === 'last7')?.label.toLowerCase() ?? '';

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
      </div>
    </div>
  );
}

// "All apps": the panel, one card per app under "By app", and the busiest events' rows.
function AllAppsSkeleton() {
  return (
    <>
      <div className="mt-10">
        <WindowPanelSkeleton />
      </div>
      <h2 className="mt-12 text-lg font-semibold text-slate-900 dark:text-slate-100">By app</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Events each app sent in the {FIRST_WINDOW}, against the same span before it.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TELEMETRY_APPS.map((app) => (
          <li key={app} className={`${CARD} p-5`}>
            <Bone text="text-sm" width="w-32" />
            <Bone text="text-3xl" width="w-24" className="mt-2" />
            <Bone text="text-sm" width="w-44" className="mt-1" />
            <Bone text="text-sm" width="w-36" className="mt-3" />
          </li>
        ))}
      </ul>
      <h2 className="mt-12 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Busiest events
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        The same event from several apps counts once here, added up.
      </p>
      <ol className={`mt-4 divide-y divide-slate-200 dark:divide-slate-800 ${CARD}`}>
        {ROW_WIDTHS.map((width, i) => (
          <li key={i} className="flex items-baseline justify-between gap-4 px-5 py-3">
            <Bone text="text-sm" width={width} className="min-w-0 flex-1" />
            <Bone text="text-sm" width="w-10" />
          </li>
        ))}
      </ol>
    </>
  );
}

// Twelve rows (AllApps' TOP_EVENTS), of varied lengths so they read as a list of names.
const ROW_WIDTHS = [
  'w-56',
  'w-44',
  'w-64',
  'w-40',
  'w-52',
  'w-48',
  'w-60',
  'w-36',
  'w-56',
  'w-44',
  'w-52',
  'w-40',
];

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

// The card groups the Dashboard tab opens on: a first row of key numbers, then a chart group.
const GROUP_SIZES = [6, 3];

// One app: the panel, the tab row, and the Dashboard tab's groups of metric cards.
function AppSkeleton() {
  return (
    <>
      <div className="mt-10">
        <WindowPanelSkeleton />
      </div>
      {/* ViewTabs' bar, its tabs as placeholders the height of a tab. */}
      <div className="mt-8 flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {['w-10', 'w-24', 'w-28', 'w-24', 'w-20'].map((width, i) => (
            <span
              key={i}
              className={`h-8 shrink-0 rounded-lg pointer-coarse:h-10 ${width} ${PULSE}`}
            />
          ))}
        </div>
      </div>
      <div className="mt-8">
        <Bone text="text-sm" width="w-full max-w-xl" />
        <div className="mt-6 flex flex-col gap-8">
          {GROUP_SIZES.map((size, g) => (
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
      <div aria-hidden>{variant === 'all' ? <AllAppsSkeleton /> : <AppSkeleton />}</div>
    </div>
  );
}
