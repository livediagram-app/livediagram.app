// A replace's `dashboard` body checked before it builds (docs/specs/026-plan/plan-agents.md "Making a dashboard"):
// its tabs by id with what each holds, its metric kinds, its charts by view (Status Breakdown is no longer offered),
// its notes. Each problem named, as graph-body.ts names a graph's.
import {
  DASHBOARD_CHART_VIEWS as CHART_VIEWS,
  DASHBOARD_METRIC_KINDS as METRIC_KINDS,
} from '@liveplanner/templates';
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function dashboardSpecIssue(input: unknown): string | null {
  if (!isObj(input)) return 'dashboard: expected an object';
  const { tabs, metrics, charts, notes } = input;
  if (tabs !== undefined) {
    if (!Array.isArray(tabs)) return 'dashboard.tabs: expected an array';
    for (const [i, t] of tabs.entries())
      if (
        !isObj(t) ||
        typeof t['tabId'] !== 'string' ||
        (t['of'] !== 'board' && t['of'] !== 'sheet')
      )
        return `dashboard.tabs[${i}]: expected { tabId, of: "board" | "sheet" }`;
  }
  if (metrics !== undefined) {
    if (!Array.isArray(metrics)) return 'dashboard.metrics: expected an array';
    for (const m of metrics)
      if (!(METRIC_KINDS as readonly unknown[]).includes(m))
        return `dashboard.metrics: ${JSON.stringify(m)} is not a metric (${METRIC_KINDS.join(', ')})`;
  }
  if (charts !== undefined) {
    if (!Array.isArray(charts)) return 'dashboard.charts: expected an array';
    for (const [i, c] of charts.entries()) {
      if (!isObj(c) || !(CHART_VIEWS as readonly unknown[]).includes(c['view']))
        return `dashboard.charts[${i}]: view is one of ${CHART_VIEWS.join(', ')}`;
      if (c['settings'] !== undefined && !isObj(c['settings']))
        return `dashboard.charts[${i}].settings: expected an object`;
    }
  }
  if (notes !== undefined) {
    if (!Array.isArray(notes)) return 'dashboard.notes: expected an array';
    for (const [i, n] of notes.entries())
      if (!isObj(n) || typeof n['title'] !== 'string' || typeof n['text'] !== 'string')
        return `dashboard.notes[${i}]: expected { title, text }`;
  }
  return null;
}
