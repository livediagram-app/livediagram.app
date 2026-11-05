import { useId } from 'react';
import { EDITOR_MODE_ICONS } from '@livehuddle/ui';
import { TEMPLATES, templateCategory } from '@livehuddle/templates';

// How many templates the panel names: one row on a desktop card.
const NAMED = 3;

// The Office Spaces a new Space's start opens on (its first group, LEADING_START_GROUP), by title: what waits there.
// Titles only, never preview art, so /new's first load carries none of the template previews.
export const START_TEMPLATE_TITLES: readonly string[] = TEMPLATES.filter(
  (t) => !t.hidden && templateCategory(t.kind) === 'office',
)
  .slice(0, NAMED)
  .map((t) => t.title);

const FlipchartMark = EDITOR_MODE_ICONS.workshop;

// The New Space wizard's "what it makes" (docs/specs/007-editor/new-document-route.md "One-step wizard"): a quiet
// panel, not a choice, naming the Blank Space that Create makes and the templates waiting on its start. Static
// markup, so the wizard's body is never empty, not even in the prerendered page.
export function NewSpaceSummary() {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-brand-50/80 via-white to-white p-4 dark:border-slate-800 dark:from-brand-500/10 dark:via-slate-900 dark:to-slate-900"
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm shadow-brand-900/20 dark:bg-brand-600"
        >
          <FlipchartMark size={22} />
        </span>
        <div className="min-w-0">
          <h3
            id={titleId}
            className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-50"
          >
            Blank Space
          </h3>
          <p className="mt-0.5 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
            Opens on its start, with templates and the session tools ready.
          </p>
        </div>
      </div>
      <div className="mt-4 border-t border-slate-200/70 pt-3 dark:border-slate-800">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Templates on its start
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {START_TEMPLATE_TITLES.map((title) => (
            <li
              key={title}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
            >
              {title}
            </li>
          ))}
          <li className="px-1 py-1 text-xs text-slate-500 dark:text-slate-400">
            and sessions to run
          </li>
        </ul>
      </div>
    </section>
  );
}
