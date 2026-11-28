'use client';

// Every Session tab's sidebar header (docs/specs/026-plan/session-tabs.md "The sidebar"): the kind's name and how far
// through it is ("4 of 9", a Stand-up's "2 of 5 people"), the set-up in words (or "Time's up"), Session Settings for
// an Editor, the facilitator's chip, then the kind's progress bar and whatever it adds under it (Sprint Planning's
// tally).
import type { ReactNode } from 'react';
import { lucideSettings } from '@liveworkspace/icons/lucide';
import { Tooltip, lucideGlyph } from '@liveplanner/ui';
import { SessionFacilitatorChip } from './SessionFacilitatorChip';
import type { SessionBaton } from './useSessionFacilitator';

const SettingsIcon = lucideGlyph(lucideSettings, 16);

export function SessionHeader({
  label,
  count,
  line,
  baton,
  onSettings,
  children,
}: {
  label: string;
  // How far through: "4 of 9"; '' with nothing queued.
  count: string;
  // The set-up in words, or "Time's up".
  line: string;
  baton: SessionBaton;
  // Session Settings, an Editor's; absent for everyone else.
  onSettings?: (() => void) | undefined;
  // The progress bar and what a kind adds under it.
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 px-4 pb-3 pt-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">
            {label}
            <span className="ml-2 text-[13px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
              {count}
            </span>
          </h2>
          <p className="truncate text-[12px] text-slate-500 dark:text-slate-400">{line}</p>
        </div>
        {onSettings ? (
          <Tooltip label="Session Settings">
            <button
              type="button"
              aria-label="Session Settings"
              onClick={onSettings}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <SettingsIcon aria-hidden />
            </button>
          </Tooltip>
        ) : null}
      </div>
      <SessionFacilitatorChip baton={baton} />
      {children}
    </div>
  );
}
