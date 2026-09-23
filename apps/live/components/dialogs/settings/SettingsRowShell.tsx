'use client';

import type { ReactNode } from 'react';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { SettingsIllustration } from './settings-illustrations';
import type { SettingsRowSpec } from './settings-catalogue';

// Everything a settings row has in common, whatever its control is: the
// bordered card holding the label and the control, then the grey footnote
// under it.
//
// The footnote lives OUTSIDE the card on purpose (iOS group-footer style).
// The old dialog packed label, a four-line description and a "Learn more"
// link into the card, which made every setting a paragraph and the list
// impossible to skim: the complaint that prompted this rework.
export function SettingsRowShell({
  row,
  control,
  // Which half of the row's illustration is in force, so the drawing rings
  // the current state. Toggle rows pass their checked state.
  illustrationActive = false,
  // A control that is its own interactive element (a slider, a segmented
  // choice) sits BESIDE the label; a whole-row switch wraps the lot, and
  // passes its own button in as `wrapper` instead.
  wrapper,
}: {
  // Only the presentational half is read here (label, description, help,
  // illustration), so every row kind satisfies it.
  row: Pick<
    SettingsRowSpec,
    'key' | 'label' | 'description' | 'helpArticle' | 'alsoIn' | 'illustration'
  >;
  control?: ReactNode;
  illustrationActive?: boolean;
  wrapper?: (children: ReactNode) => ReactNode;
}) {
  const label = (
    <span className="min-w-0 text-sm font-medium text-slate-800 dark:text-slate-100">
      {row.label}
    </span>
  );
  const body = (
    <>
      {label}
      {control}
    </>
  );

  return (
    <div className="flex flex-col">
      {wrapper ? (
        wrapper(body)
      ) : (
        <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800">
          {body}
        </div>
      )}
      {row.illustration ? (
        <SettingsIllustration id={row.illustration} active={illustrationActive} />
      ) : null}
      <p
        id={`${row.key}-description`}
        className="mt-1.5 px-3.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400"
      >
        {row.description}
        {row.helpArticle ? (
          <>
            {' '}
            <HelpArticleLink article={row.helpArticle} variant="text" />
          </>
        ) : null}
        {/* Settings now lists every preference, including the ones whose
            day-to-day home is a panel's own gear. Saying so keeps the two
            from reading as rival controls for the same thing. */}
        {row.alsoIn ? (
          <span className="block text-slate-400 dark:text-slate-500">Also in {row.alsoIn}.</span>
        ) : null}
      </p>
    </div>
  );
}
