'use client';

// The connect box (docs/specs/030-forms/forms.md "Responses Go To and Settings"): a card under the form's title while
// it sends its responses nowhere (no board, no sheet), drawn as the form's own cards are, so an Editor connects it
// before anything else. Two choices side by side, each making its tab in one press: Cards on a Board (New Board) and
// Rows in a Sheet (New Sheet); Choose Existing (when the document has a board or sheet) opens Responses Go To.
import { lucideGlyph } from '@livedesign/ui';
import { lucideSquareKanban, lucideTable } from '@livedesign/icons/lucide';
import { DESTINATION_PROBLEM_TEXT, type DestinationProblem } from '@livedesign/forms';
import { track } from '@/lib/telemetry';
import { useFormBuilder } from './form-builder-context';

const BoardIcon = lucideGlyph(lucideSquareKanban, 18);
const SheetIcon = lucideGlyph(lucideTable, 18);

const CHOICE =
  'group/choice flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-[var(--form-accent)] hover:bg-[color-mix(in_srgb,var(--form-accent)_5%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--form-accent)] dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800';
const CHOICE_ICON =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition group-hover/choice:bg-[var(--form-accent)] group-hover/choice:text-white dark:bg-slate-800 dark:text-slate-300';

export function FormConnectCard({
  hasExisting,
  problem = null,
}: {
  hasExisting: boolean;
  // Why the board or sheet it named no longer takes responses (its tab deleted, its column gone): the box comes back.
  problem?: DestinationProblem | null;
}) {
  const b = useFormBuilder();
  const nowhere = !b.form.destination && !b.form.sheet;
  if (!b.canEdit || (!nowhere && !problem)) return null;
  return (
    <section
      aria-labelledby="form-connect-title"
      data-form-connect=""
      className="form-box form-ink relative overflow-hidden rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm max-sm:px-4 dark:border-slate-700/80 dark:bg-slate-900"
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-[var(--form-accent)]" />
      <h2
        id="form-connect-title"
        className="text-[15px] font-semibold text-slate-900 dark:text-slate-50"
      >
        Where Should Responses Go?
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
        {problem && !nowhere
          ? DESTINATION_PROBLEM_TEXT[problem]
          : 'Choose before you publish: the form can’t take responses until it has somewhere to put them.'}
      </p>
      <div className="mt-4 flex gap-3 max-sm:flex-col">
        <button
          type="button"
          onClick={() => {
            track('Form', 'Linked', 'ConnectNewBoard');
            b.actions.newResponsesBoard();
          }}
          className={CHOICE}
        >
          <span className={CHOICE_ICON}>
            <BoardIcon aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-slate-900 dark:text-slate-50">
              Cards on a Board
            </span>
            <span className="mt-0.5 block text-[12px] leading-snug text-slate-500 dark:text-slate-400">
              A card for each response, to work through. Makes a new board.
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            track('Form', 'Linked', 'ConnectNewSheet');
            b.actions.newResponsesSheet();
          }}
          className={CHOICE}
        >
          <span className={CHOICE_ICON}>
            <SheetIcon aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-slate-900 dark:text-slate-50">
              Rows in a Sheet
            </span>
            <span className="mt-0.5 block text-[12px] leading-snug text-slate-500 dark:text-slate-400">
              A row for each response, to count and compare. Makes a new sheet.
            </span>
          </span>
        </button>
      </div>
      {hasExisting ? (
        <button
          type="button"
          onClick={() => {
            track('Form', 'Linked', 'ConnectChoose');
            b.openSettings('destination');
          }}
          className="mt-3 cursor-pointer text-[13px] font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-slate-50"
        >
          Or use a board or sheet you already have
        </button>
      ) : null}
    </section>
  );
}
