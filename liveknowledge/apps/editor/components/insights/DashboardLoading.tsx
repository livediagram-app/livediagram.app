// Insights while its read is out (docs/specs/030-knowledgebase/blueprints/insights-ui.md "States"): the
// dashboard's own shape, a tile a topic, in quiet placeholders, so nothing jumps when it lands.
const BLOCK =
  'rounded-2xl border border-slate-200 bg-white motion-safe:animate-pulse dark:border-slate-800 dark:bg-slate-900';

export function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading Insights" className="grid gap-4 sm:gap-5 lg:grid-cols-2">
      {[0, 1, 2, 3].map((at) => (
        <div key={at} className={`h-72 ${BLOCK}`} />
      ))}
    </div>
  );
}
