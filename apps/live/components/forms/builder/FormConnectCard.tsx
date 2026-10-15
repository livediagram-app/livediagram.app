'use client';

// The connect box (docs/specs/030-forms/forms.md "Responses Go To and Settings"): above the form's title while it
// sends its responses nowhere (no board, no sheet), so an Editor connects it before anything else. New Board and New
// Sheet each connect it in one press; Choose Existing (when the document has a board or sheet) opens Responses Go To.
import { lucideGlyph } from '@livediagram/ui';
import { lucideSquareKanban, lucideTable } from '@livediagram/icons/lucide';
import { track } from '@/lib/telemetry';
import { useFormBuilder } from './form-builder-context';

const BoardIcon = lucideGlyph(lucideSquareKanban, 16);
const SheetIcon = lucideGlyph(lucideTable, 16);

const BUTTON =
  'flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition';

export function FormConnectCard({ hasExisting }: { hasExisting: boolean }) {
  const b = useFormBuilder();
  if (!b.canEdit || b.form.destination || b.form.sheet) return null;
  return (
    <section
      aria-labelledby="form-connect-title"
      data-form-connect=""
      className="rounded-xl border border-dashed border-brand-300 bg-brand-50/70 px-5 py-4 dark:border-brand-500/40 dark:bg-brand-500/10"
    >
      <h2
        id="form-connect-title"
        className="text-[15px] font-semibold text-slate-900 dark:text-slate-50"
      >
        Where Should Responses Go?
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
        Connect this form to a board, a card for each response, or to a sheet, a row for each. It
        can be published once it is connected.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            track('Form', 'Linked', 'ConnectNewBoard');
            b.actions.newResponsesBoard();
          }}
          className={`${BUTTON} border-brand-700 bg-brand-700 text-white hover:bg-brand-800 dark:border-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700`}
        >
          <BoardIcon aria-hidden />
          New Board
        </button>
        <button
          type="button"
          onClick={() => {
            track('Form', 'Linked', 'ConnectNewSheet');
            b.actions.newResponsesSheet();
          }}
          className={`${BUTTON} border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800`}
        >
          <SheetIcon aria-hidden />
          New Sheet
        </button>
        {hasExisting ? (
          <button
            type="button"
            onClick={() => {
              track('Form', 'Linked', 'ConnectChoose');
              b.openSettings('destination');
            }}
            className="h-9 cursor-pointer rounded-lg px-2 text-[13px] font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
          >
            Choose Existing
          </button>
        ) : null}
      </div>
    </section>
  );
}
