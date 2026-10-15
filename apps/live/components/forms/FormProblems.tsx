'use client';

// What stands between a form and its responses (docs/specs/030-forms/forms.md "Publishing and the form link"), listed
// in Share Form, before publishing and after: responses with nowhere to go (with Choose Where Responses Go), and each
// publish check that fails (with Show). The status bar's Problems with this Form opens it.
import {
  DESTINATION_PROBLEM_TEXT,
  PUBLISH_PROBLEM_TEXT,
  type DestinationProblem,
  type PublishProblem,
} from '@livediagram/forms';

/** How many problems a form has: its destination's, and each failing publish check. */
export const formProblemCount = (
  problem: DestinationProblem | null,
  notReady: readonly PublishProblem[],
): number => (problem ? 1 : 0) + notReady.length;

const LINK = 'shrink-0 cursor-pointer font-semibold underline underline-offset-2';

export function FormProblems({
  title,
  problem,
  notReady,
  onFixDestination,
  onShow,
}: {
  title: string;
  problem: DestinationProblem | null;
  notReady: readonly PublishProblem[];
  onFixDestination?: () => void;
  onShow?: (problem: PublishProblem) => void;
}) {
  if (!formProblemCount(problem, notReady)) return null;
  return (
    <div
      role="status"
      className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-100"
    >
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {problem ? (
          <li className="flex items-baseline justify-between gap-3">
            <span>Responses have nowhere to go. {DESTINATION_PROBLEM_TEXT[problem]}</span>
            {onFixDestination ? (
              <button type="button" onClick={onFixDestination} className={LINK}>
                Choose Where Responses Go
              </button>
            ) : null}
          </li>
        ) : null}
        {notReady.map((p, i) => (
          <li key={i} className="flex items-baseline justify-between gap-3">
            <span>{PUBLISH_PROBLEM_TEXT[p.kind]}</span>
            {onShow && p.kind !== 'no_questions' ? (
              <button type="button" onClick={() => onShow(p)} className={LINK}>
                Show
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
