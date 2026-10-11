'use client';

import { SwitchRow } from '@/components/primitives/SwitchRow';

// The two faces of skipping the Location step (docs/specs/013-workspace/default-folders.md
// "Skipping the Location step"): the Location step's switch that turns it on, and the quiet
// "Saving in <place>" line the one-step wizard shows instead, with Change.

const PLACE = 'font-semibold text-slate-800 dark:text-slate-100';

/** The last row of the Location step. Its own row, so the default-folder slot above never moves. */
export function WizardSkipLocationCheckbox({
  placeName,
  checked,
  onChange,
}: {
  placeName: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  return (
    // In a row card, as a switch in Settings is (SettingsRowShell), drawn up close under the folders.
    <div className="-mt-5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800">
      <SwitchRow
        checked={checked}
        onChange={onChange}
        className="text-sm text-slate-600 dark:text-slate-300"
      >
        Always save new documents in <span className={PLACE}>{placeName}</span> and skip this step
      </SwitchRow>
    </div>
  );
}

/** The first row of the one-step wizard's footer: where the document goes, and Change for this one. */
export function WizardSavingIn({
  placeName,
  onChange,
}: {
  placeName: string;
  onChange: () => void;
}) {
  return (
    <p
      role="note"
      className="flex min-w-0 flex-wrap items-center gap-x-1.5 px-6 pt-3 text-xs text-slate-600 dark:text-slate-300"
    >
      <span className="min-w-0 truncate">
        Saving in <span className={PLACE}>{placeName}</span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="rounded font-semibold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-brand-300 dark:focus-visible:outline-brand-400"
      >
        Change
      </button>
    </p>
  );
}
