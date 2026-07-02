'use client';

import { EmptyState } from '@livediagram/ui';
import {
  metricKey,
  type TelemetryCount,
  type TelemetryDaily,
  type TelemetrySummary,
  type TelemetryWindowKey,
} from '@livediagram/api-schema';
import { categoryColor } from './event-vocab';
import { ActivityGlyph } from './glyphs';
import { MiniSparkline } from './MiniSparkline';
import { RankCard, rank } from './RankCard';
import { windowLabel } from './windows';

// Look & Feel view (spec/22): which visual presets get picked, most to
// least, plus how much the custom-theme builder gets used. The presets
// are ranked usage lists — templates (`Template·Used·<id>`), built-in
// themes (`Theme·Changed·<name>`), canvas patterns (`Canvas·Changed·
// <pattern>`) — first/last tagged Most / Least used. The custom-theme
// builder is a lifecycle, not a ranking, so it shows its four actions
// (created / applied / edited / deleted) as counts. Everything reflects
// the global window; we can only show presets that have events in it.

// Theme·Changed types that are NOT built-in theme picks, so the theme
// ranking excludes them: the custom-theme builder's applied/edited
// variants, and the one-shot "reset elements to theme" recolour
// (`ResetElements`), which would otherwise compete in the leaderboard.
const CUSTOM_THEME_TYPES = new Set(['Custom', 'CustomEdited', 'ResetElements']);

export function LookAndFeelView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const rows = summary.windows[active].rows;
  const templates = rank(rows, (r) => r.category === 'Template' && r.action === 'Used');
  const themes = rank(
    rows,
    (r) =>
      r.category === 'Theme' && r.action === 'Changed' && !CUSTOM_THEME_TYPES.has(r.type ?? ''),
  );
  const canvas = rank(rows, (r) => r.category === 'Canvas' && r.action === 'Changed');

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Which templates, themes, and canvas styles get used, for{' '}
        <span className="font-medium">{windowLabel(active)}</span> — most to least picked.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RankCard
          title="Templates"
          subtitle="Scaffolds picked when starting a diagram or seeding a tab"
          category="Template"
          action="Used"
          items={templates}
          daily={summary.daily}
          emptyLabel="No templates were used in this window yet."
        />
        <RankCard
          title="Themes"
          subtitle="Built-in canvas palettes switched onto a tab"
          category="Theme"
          action="Changed"
          items={themes}
          daily={summary.daily}
          emptyLabel="No theme switches in this window yet."
        />
        <RankCard
          title="Canvas styles"
          subtitle="Background patterns applied to the canvas"
          category="Canvas"
          action="Changed"
          items={canvas}
          daily={summary.daily}
          emptyLabel="No canvas-style changes in this window yet."
        />
        <CustomThemeCard rows={rows} daily={summary.daily} />
      </div>
    </div>
  );
}

// The custom-theme builder's four lifecycle actions (spec/22): created,
// applied, edited, deleted. Not a ranking — distinct verbs — so shown as
// labelled stat tiles with their own mini trend.
const CUSTOM_THEME_METRICS: {
  label: string;
  category: string;
  action: string;
  type: string;
}[] = [
  { label: 'Created', category: 'Theme', action: 'Created', type: 'Custom' },
  { label: 'Applied', category: 'Theme', action: 'Changed', type: 'Custom' },
  { label: 'Edited', category: 'Theme', action: 'Changed', type: 'CustomEdited' },
  { label: 'Deleted', category: 'Theme', action: 'Deleted', type: 'Custom' },
];

function CustomThemeCard({
  rows,
  daily,
}: {
  rows: TelemetryCount[];
  daily: TelemetryDaily | undefined;
}) {
  const color = categoryColor('Theme');
  const find = (category: string, action: string, type: string) =>
    rows.find((r) => r.category === category && r.action === action && r.type === type)?.count ?? 0;
  const anyData = CUSTOM_THEME_METRICS.some((m) => find(m.category, m.action, m.type) > 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
        Custom theme builder
      </h3>
      <p className="mt-0.5 text-xs text-slate-400">
        Building, applying, and tweaking bespoke palettes
      </p>
      {anyData ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {CUSTOM_THEME_METRICS.map((m) => {
            const series = daily?.byMetric[metricKey(m.category, m.action, m.type)];
            return (
              <div
                key={m.label}
                className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {m.label}
                </p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                    {find(m.category, m.action, m.type).toLocaleString()}
                  </span>
                  {series ? (
                    <MiniSparkline values={series} color={color} className="h-5 w-14" />
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            icon={<ActivityGlyph />}
            title="Nothing yet"
            description="No custom themes were built in this window yet."
          />
        </div>
      )}
    </div>
  );
}
