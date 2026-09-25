import { metricKey, type TelemetryCount } from '@livediagram/api-schema';

// Old spelling -> current token, for one ranking's type column. Historic rows
// keep the spelling they were stored with; a ranking that folds them in reads
// one item per thing during the retention window instead of splitting it.
export type TypeAliases = Readonly<Record<string, string>>;

// Merge rows that name the same thing once `aliases` is applied: the old
// spelling's count joins the current token's row.
export function foldAliases(rows: TelemetryCount[], aliases: TypeAliases): TelemetryCount[] {
  const merged = new Map<string, TelemetryCount>();
  for (const r of rows) {
    const type = r.type === null ? null : (aliases[r.type] ?? r.type);
    const key = metricKey(r.category, r.action, type);
    const prev = merged.get(key);
    merged.set(key, prev ? { ...prev, count: prev.count + r.count } : { ...r, type });
  }
  return [...merged.values()];
}

// Filter rows to a predicate (with a non-empty type) and sort by count desc.
// With `aliases`, rows are folded first, so the predicate sees current tokens.
export function rank(
  rows: TelemetryCount[],
  predicate: (r: TelemetryCount) => boolean,
  aliases?: TypeAliases,
): TelemetryCount[] {
  const folded = aliases ? foldAliases(rows, aliases) : rows;
  return folded.filter((r) => predicate(r) && r.type).sort((a, b) => b.count - a.count);
}

// The 30-day series for one ranked row: its own metric plus every old
// spelling that folds into it. Undefined when none of them has a series.
export function aliasedSeries(
  byMetric: Record<string, number[]>,
  category: string,
  action: string,
  type: string | null,
  aliases?: TypeAliases,
): number[] | undefined {
  const keys = [metricKey(category, action, type)];
  for (const [from, to] of Object.entries(aliases ?? {})) {
    if (to === type) keys.push(metricKey(category, action, from));
  }
  const series = keys.map((k) => byMetric[k]).filter((s): s is number[] => !!s);
  if (series.length === 0) return undefined;
  return series[0]!.map((_, i) => series.reduce((sum, s) => sum + (s[i] ?? 0), 0));
}
