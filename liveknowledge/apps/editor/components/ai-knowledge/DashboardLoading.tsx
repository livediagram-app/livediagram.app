// Insights while its read is out (docs/specs/030-knowledgebase/blueprints/ai-knowledge-ui.md "States"): the
// dashboard's own shape in quiet placeholders, so nothing jumps when it lands.
const BLOCK =
  'rounded-2xl border border-slate-200 bg-white motion-safe:animate-pulse dark:border-slate-800 dark:bg-slate-900';

export function DashboardLoading() {
  return (
    <div role="status" aria-label="Loading Insights" className="flex flex-col gap-4 sm:gap-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((at) => (
          <div key={at} className={`h-28 ${BLOCK}`} />
        ))}
      </div>
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
        <div className={`h-96 lg:col-span-2 ${BLOCK}`} />
        <div className={`h-64 ${BLOCK}`} />
      </div>
    </div>
  );
}
