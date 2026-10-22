import type { TelemetrySummary, TelemetryWindow } from '@livepages/api-schema';

// Events of features that no longer exist (docs/specs/017-telemetry/telemetry.md "Retired features").
// The stored rows stay in D1 until retention ages them out, but the dashboard
// treats the feature as gone: these events are dropped from the summary the
// moment it arrives, so no chart, stack, ranking or total ever renders them.
// Their explanation sentences stay in event-explanations.ts for Search.

// The editor's Activity panel (removed 2026-10-03, docs/specs/012-collaboration/README.md "Removed: the
// Activity panel"): its per-entry revert, the panel opening, its Settings
// rows, and its help articles. The Undo and Redo articles kept their slugs
// when they moved to Canvas, so their series carry on and are not listed.
const ACTIVITY_PANEL_HELP_IDS = new Set([
  'activity-panel',
  'what-it-is',
  'how-it-works',
  'reverting-changes',
]);
const ACTIVITY_PANEL_UI_TYPES = new Set([
  'Activity',
  'SettingsActivity',
  'ActivityPanelOn',
  'ActivityPanelOff',
  'ActivityRevertPreviewOn',
  'ActivityRevertPreviewOff',
]);

// The palette's Favourites (removed 2026-10-03, docs/specs/010-palette/palette-favourites.md): its
// curation (add, remove, reorder or reset, the Edit / Reorder modes), its cross-category search,
// and its help article (now Popular's, at a new address).
const PALETTE_FAVOURITES_UI = new Set([
  'Added|PaletteFavourite',
  'Removed|PaletteFavourite',
  'Changed|PaletteFavourite',
  'Toggled|PaletteFavouritesEdit',
  'Searched|PaletteSearch',
]);
const PALETTE_FAVOURITES_HELP_ID = 'favourites';

// Settings › Experimental (removed 2026-10-06): the category opening and its Pages Mode and Plan
// Mode switches. Pages is the one mode now (docs/specs/007-editor/pages-mode.md "One mode").
const EXPERIMENTAL_SETTINGS_UI = new Set([
  'Opened|SettingsExperimental',
  'Toggled|PagesModeOn',
  'Toggled|PagesModeOff',
  'Toggled|PlanModeOn',
  'Toggled|PlanModeOff',
]);

// The New Document wizard's Location step and the editor's Quick Start (removed 2026-10-16,
// docs/specs/007-editor/new-document-route.md "One-step wizard"): "Always save new documents in <place> and skip this
// step" and Settings' Turn Off, the Quick Start shelf's expand toggle and its mode filter. Templates are picked on each
// mode's start now, whose search reaches the other modes (UI·Used·StartOtherMode).
const LOCATION_STEP_AND_QUICK_START_UI = new Set([
  'Toggled|SkipLocationStepOn',
  'Toggled|SkipLocationStepOff',
  'Toggled|TemplateShelfExpanded',
  'Toggled|TemplateShelfCollapsed',
  'Toggled|TemplateModeAll',
  'Toggled|TemplateModeDiagram',
  'Toggled|TemplateModeDraw',
  'Toggled|TemplateModeWorkshop',
  'Toggled|TemplateModePages',
  'Toggled|TemplateModePlan',
]);

export function isRetiredEvent(category: string, action: string, type: string | null): boolean {
  if (category === 'Document' && action === 'Reverted') return true;
  if (category === 'UI' && PALETTE_FAVOURITES_UI.has(`${action}|${type ?? ''}`)) return true;
  if (category === 'UI' && EXPERIMENTAL_SETTINGS_UI.has(`${action}|${type ?? ''}`)) return true;
  if (category === 'UI' && LOCATION_STEP_AND_QUICK_START_UI.has(`${action}|${type ?? ''}`))
    return true;
  if (category === 'Help') {
    return ACTIVITY_PANEL_HELP_IDS.has(type ?? '') || type === PALETTE_FAVOURITES_HELP_ID;
  }
  if (category === 'UI' && (action === 'Opened' || action === 'Toggled')) {
    if (ACTIVITY_PANEL_UI_TYPES.has(type ?? '')) return true;
    return (
      action === 'Opened' &&
      (ACTIVITY_PANEL_HELP_IDS.has(type ?? '') || type === PALETTE_FAVOURITES_HELP_ID)
    );
  }
  return false;
}

function dropFromWindow(window: TelemetryWindow): TelemetryWindow {
  let dropped = 0;
  const rows = window.rows.filter((r) => {
    if (!isRetiredEvent(r.category, r.action, r.type)) return true;
    dropped += r.count;
    return false;
  });
  return dropped === 0 ? window : { total: window.total - dropped, rows };
}

const splitKey = (key: string): [string, string, string | null] => {
  const [category = '', action = '', type = ''] = key.split('|');
  return [category, action, type === '' ? null : type];
};

// The summary without any retired event: window rows and totals, the
// previous windows behind the trend arrows, and the daily series (each
// retired series also comes off its category's line and the day totals).
export function dropRetiredEvents(summary: TelemetrySummary): TelemetrySummary {
  // A deployment with telemetry off answers `{ enabled: false }` and nothing else: there is nothing to drop, and
  // reading its absent windows threw, which the dashboard took for a failed request ("Couldn't load the
  // numbers") instead of showing that telemetry is off here.
  if (!summary.enabled || !summary.windows) return summary;
  const windows = Object.fromEntries(
    Object.entries(summary.windows).map(([k, w]) => [k, dropFromWindow(w)]),
  ) as TelemetrySummary['windows'];
  const previousWindows = summary.previousWindows
    ? (Object.fromEntries(
        Object.entries(summary.previousWindows).map(([k, w]) => [k, dropFromWindow(w)]),
      ) as TelemetrySummary['previousWindows'])
    : undefined;
  let daily = summary.daily;
  if (daily) {
    const retired = Object.keys(daily.byMetric).filter((key) => isRetiredEvent(...splitKey(key)));
    if (retired.length > 0) {
      const byMetric = { ...daily.byMetric };
      const byCategory = { ...daily.byCategory };
      const totals = [...daily.totals];
      for (const key of retired) {
        const series = byMetric[key] ?? [];
        delete byMetric[key];
        const [category] = splitKey(key);
        const line = byCategory[category];
        if (line) byCategory[category] = line.map((n, i) => Math.max(0, n - (series[i] ?? 0)));
        series.forEach((n, i) => {
          totals[i] = Math.max(0, (totals[i] ?? 0) - n);
        });
      }
      daily = { ...daily, byMetric, byCategory, totals };
    }
  }
  return {
    ...summary,
    windows,
    ...(previousWindows ? { previousWindows } : {}),
    ...(daily ? { daily } : {}),
  };
}
