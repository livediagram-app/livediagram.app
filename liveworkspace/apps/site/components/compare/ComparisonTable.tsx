import type { Alternative } from '@/lib/alternatives';
import type { CompareVoice } from './compare-theme';

// The at-a-glance table on a comparison page: one row per topic, our column tinted with the
// voice's accent. The caption is sr-only so the layout gains no extra heading row, while screen
// readers and search-engine table extraction get a self-describing summary; scope="col" /
// scope="row" make the cell relationships explicit. Phones scroll it sideways inside its card
// rather than the page.
export function ComparisonTable({ alt, voice }: { alt: Alternative; voice: CompareVoice }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <caption className="sr-only">
            {voice.name} vs {alt.name}: feature-by-feature comparison
          </caption>
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th scope="col" className="w-1/4 px-5 py-4">
                <span className="sr-only">Feature</span>
              </th>
              <th
                scope="col"
                className="bg-[color-mix(in_srgb,var(--lw-accent)_10%,transparent)] px-5 py-4 font-semibold text-[var(--lw-ink)] dark:text-[var(--lw-ink-dark)]"
              >
                {voice.name}
              </th>
              <th
                scope="col"
                className="px-5 py-4 font-semibold text-slate-900 dark:text-slate-100"
              >
                {alt.name}
              </th>
            </tr>
          </thead>
          <tbody>
            {alt.rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-slate-100 align-top last:border-0 dark:border-slate-800"
              >
                <th
                  scope="row"
                  className="px-5 py-4 font-medium text-slate-900 dark:text-slate-100"
                >
                  {row.label}
                </th>
                <td className="bg-[color-mix(in_srgb,var(--lw-accent)_5%,transparent)] px-5 py-4 leading-relaxed text-slate-800 dark:text-slate-100">
                  {row.us}
                </td>
                <td className="px-5 py-4 leading-relaxed text-slate-600 dark:text-slate-300">
                  {row.them}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
