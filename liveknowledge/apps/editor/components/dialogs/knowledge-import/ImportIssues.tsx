import type { IssueGroup } from '@/lib/knowledge-import/import-copy';

// What an import leaves out or changes, a group a kind (docs/specs/020-import-export/knowledgebase-import.md "Where
// it lands"): how many, what happens to them, and the first few by name.
export function ImportIssues({ groups }: { groups: readonly IssueGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <section aria-label="Left Out or Changed">
      <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
        Left Out or Changed
      </h3>
      <ul className="mt-2 space-y-2">
        {groups.map((group) => (
          <li
            key={group.key}
            data-issue={group.key}
            className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
          >
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              {group.title}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
              {group.detail}
            </p>
            {group.examples.length > 0 ? (
              <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {group.examples.map((example, i) => (
                  <li key={i} className="truncate">
                    {example}
                  </li>
                ))}
                {group.more > 0 ? <li>and {group.more.toLocaleString('en-GB')} more</li> : null}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
