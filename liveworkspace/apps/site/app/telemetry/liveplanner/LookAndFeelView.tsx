'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@liveplanner/api-schema';
import { NON_PATTERN_CANVAS_TYPES, THEME_ALIASES, isNonThemePick } from './look-feel-types';
import { CardColumns } from './CardColumns';
import { RankCard, rank } from './RankCard';
import { rankTrend, windowLabel } from './windows';

// Look & Feel section of the Features tab (docs/specs/017-telemetry/telemetry.md): which visual presets get picked, most to
// least. The presets are ranked usage lists (templates `Template·Used·<id>`,
// built-in themes `Theme·Changed·<name>`, canvas patterns
// `Canvas·Changed·<pattern>`), the top row tagged Most used. Everything
// reflects the global window; we can only show presets that have events in it.
//
// Theme·Changed is not only a switch: the New Project wizard and the
// template picker both fire it for the theme they start the tab with, so the
// Themes card counts themes CHOSEN, at creation or later, and says so.

export { NON_PATTERN_CANVAS_TYPES, THEME_ALIASES } from './look-feel-types';

export function LookAndFeelView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const rows = summary.windows[active].rows;
  const trend = rankTrend(summary, active);
  const templates = rank(rows, (r) => r.category === 'Template' && r.action === 'Used');
  const themes = rank(
    rows,
    (r) => r.category === 'Theme' && r.action === 'Changed' && !isNonThemePick(r.type),
    THEME_ALIASES,
  );
  const canvas = rank(
    rows,
    (r) =>
      r.category === 'Canvas' &&
      r.action === 'Changed' &&
      !NON_PATTERN_CANVAS_TYPES.includes(r.type ?? ''),
  );

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Which templates, themes, and canvas styles get used, for{' '}
        <span className="font-medium">{windowLabel(active)}</span>, most to least picked.
      </p>

      <div className="mt-6">
        <CardColumns>
          <RankCard
            trend={trend}
            title="Templates"
            subtitle="Scaffolds picked when starting a project or seeding a tab"
            category="Template"
            action="Used"
            items={templates}
            daily={summary.daily}
            emptyLabel="No templates were used in this window yet."
          />
          <RankCard
            trend={trend}
            title="Themes Chosen"
            subtitle="Built-in palettes picked for a tab, including the one chosen when a project or template is created"
            category="Theme"
            action="Changed"
            items={themes}
            daily={summary.daily}
            aliases={THEME_ALIASES}
            emptyLabel="No themes were chosen in this window yet."
          />
          <RankCard
            trend={trend}
            title="Canvas Styles"
            subtitle="Background patterns picked for the canvas (colour, opacity and scale tweaks are not counted)"
            category="Canvas"
            action="Changed"
            items={canvas}
            daily={summary.daily}
            emptyLabel="No canvas-style changes in this window yet."
          />
        </CardColumns>
      </div>
    </div>
  );
}
