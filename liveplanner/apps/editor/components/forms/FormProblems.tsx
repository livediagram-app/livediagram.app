'use client';

// What stands between a form and its responses (docs/specs/030-forms/forms.md "Publishing and the form link"), listed
// in Share Form, before publishing and after: responses with nowhere to go (with Choose Where Responses Go), each
// publish check that fails (with Show), and the warnings that hold nothing back (a column its card type leaves out,
// with Choose Where Responses Go). The status bar's Problems with this Form opens it.
import {
  DESTINATION_PROBLEM_TEXT,
  publishProblemText,
  type DestinationProblem,
  type PublishProblem,
} from '@liveplanner/forms';

/** How many problems a form has: its destination's, each failing publish check, and any warnings given. */
export const formProblemCount = (
  problem: DestinationProblem | null,
  notReady: readonly PublishProblem[],
  warnings: readonly string[] = [],
): number => (problem ? 1 : 0) + notReady.length + warnings.length;

const LINK = 'shrink-0 cursor-pointer font-semibold underline underline-offset-2';

export function FormProblems({
  title,
  problem,
  notReady,
  warnings = [],
  onFixDestination,
  onShow,
}: {
  title: string;
  problem: DestinationProblem | null;
  notReady: readonly PublishProblem[];
  // Listed, but holding back neither Publish Form nor Accepting Responses.
  warnings?: readonly string[];
  onFixDestination?: () => void;
  onShow?: (problem: PublishProblem) => void;
}) {
  if (!formProblemCount(problem, notReady, warnings)) return null;
  return (
    <div
      role="status"
      className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {problem ? (
          <li className="flex items-baseline justify-between gap-3">
            <span>
              {problem === 'no_destination'
                ? 'Responses have nowhere to go yet: choose a board or a sheet.'
                : DESTINATION_PROBLEM_TEXT[problem]}
            </span>
            {onFixDestination ? (
              <button type="button" onClick={onFixDestination} className={LINK}>
                Choose Where Responses Go
              </button>
            ) : null}
          </li>
        ) : null}
        {notReady.map((p, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3">
            <span>{publishProblemText(p)}</span>
            {/* Show for a question's or a section's problem: a form-level one has nothing to point at. */}
            {'ruleId' in p && p.ruleId ? (
              onFixDestination ? (
                <button type="button" onClick={onFixDestination} className={LINK}>
                  Choose Where Responses Go
                </button>
              ) : null
            ) : onShow && ('questionId' in p || 'sectionId' in p) ? (
              <button type="button" onClick={() => onShow(p)} className={LINK}>
                Show
              </button>
            ) : null}
          </li>
        ))}
        {warnings.map((w) => (
          <li key={w} className="flex items-baseline justify-between gap-3">
            <span>{w}</span>
            {onFixDestination ? (
              <button type="button" onClick={onFixDestination} className={LINK}>
                Choose Where Responses Go
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
