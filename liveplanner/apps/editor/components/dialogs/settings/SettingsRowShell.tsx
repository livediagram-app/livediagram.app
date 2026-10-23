'use client';

import type { ReactNode } from 'react';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { SettingsIllustration } from './settings-illustrations';
import type { SettingsRowSpec } from './settings-catalogue';
import { Glyph } from '@liveplanner/ui';
import { SETTINGS_CARD, useInSettingsGroup } from './SettingsGroup';
import { rowSharedAcrossApps } from './settings-all-apps';

// Everything a settings row has in common, whatever its control is: one CELL holding the label
// with a short description under it, the control beside them, and below them whatever the row
// adds (an illustration, a list, a note).
//
// Inside a SettingsGroup the cell is bare and the group draws the card around a whole section, the
// iOS grouped-list look. On its own (a panel reusing a row) the cell draws its own card.
//
// The description sits INSIDE the cell, under the label, rather than as a footnote below a card per
// row: a footnote per row made every setting a card plus a paragraph, which is what made the
// dialog hard to skim. Descriptions are written to be one or two short lines for that reason.
export function SettingsRowShell({
  row,
  control,
  leading,
  children,
  // Choice rows: the option in force, which their drawing rings.
  illustrationValue,
  // Clicking an option of the drawing picks it, the way clicking the picture
  // of what you want is the obvious move (minus the ones it can't pick right now).
  onIllustrationChoose,
  illustrationDisabled,
  // A short info line for a row whose options are limited right now (a desktop-only row on a
  // phone). Not part of the description, which says what the setting IS.
  notice,
  // The description with inline content (a link, a live status), where the plain text of
  // `row.description` is not enough. `row.description` stays the searchable text.
  descriptionContent,
  // The whole cell answers the pointer: a switch row, whose switch stretches over the cell.
  interactive = false,
  // Greyed: a desktop-only row on a phone.
  dimmed = false,
}: {
  // Only the presentational half is read here (label, description, help,
  // illustration), so every row kind satisfies it.
  row: Pick<
    SettingsRowSpec,
    'key' | 'label' | 'description' | 'helpArticle' | 'alsoIn' | 'illustration'
  >;
  control?: ReactNode;
  // Before the label: an avatar, a provider's mark.
  leading?: ReactNode;
  // Below the label line, inside the cell.
  children?: ReactNode;
  illustrationValue?: string;
  onIllustrationChoose?: (value: string) => void;
  illustrationDisabled?: readonly string[];
  notice?: ReactNode;
  descriptionContent?: ReactNode;
  interactive?: boolean;
  dimmed?: boolean;
}) {
  const inGroup = useInSettingsGroup();
  const allApps = rowSharedAcrossApps(row.key);
  const described = Boolean(descriptionContent ?? row.description) || !!row.helpArticle || allApps;

  const cell = (
    <div
      data-settings-cell={row.key}
      className={`relative flex flex-col gap-3 rounded-[inherit] px-4 py-3 ${
        interactive ? 'transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40' : ''
      }`}
    >
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${dimmed ? 'opacity-50' : ''}`}>
        {leading}
        <div className="min-w-[9rem] flex-1">
          <div
            id={`${row.key}-label`}
            className="text-sm font-medium text-slate-800 dark:text-slate-100"
          >
            {row.label}
          </div>
          {described ? (
            <p
              id={`${row.key}-description`}
              className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
            >
              {descriptionContent ?? row.description}
              {row.helpArticle ? (
                // Above a switch row's stretched click target, so the link stays its own click.
                <span className="relative z-[1]">
                  {' '}
                  <HelpArticleLink article={row.helpArticle} variant="text" />
                </span>
              ) : null}
              {/* Where the same setting also has an in-context control, so the two read as one
                  setting with two doors rather than rival controls. */}
              {row.alsoIn ? (
                <span className="mt-0.5 block text-slate-500 dark:text-slate-400">
                  Also in {row.alsoIn}.
                </span>
              ) : null}
              {/* A setting every liveworkspace app shares: changing it here changes it there. */}
              {allApps ? (
                <span
                  data-settings-all-apps
                  className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400"
                >
                  All apps
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        {control ? <div className="ml-auto flex shrink-0 items-center gap-2">{control}</div> : null}
      </div>
      {row.illustration ? (
        <div className={`relative z-[1] ${dimmed ? 'opacity-50' : ''}`}>
          <SettingsIllustration
            id={row.illustration}
            value={illustrationValue}
            onChoose={onIllustrationChoose}
            disabledValues={illustrationDisabled}
          />
        </div>
      ) : null}
      {children}
      {notice ? (
        <p
          role="note"
          className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300"
        >
          <InfoGlyph />
          <span>{notice}</span>
        </p>
      ) : null}
    </div>
  );

  return inGroup ? cell : <div className={SETTINGS_CARD}>{cell}</div>;
}

function InfoGlyph() {
  return (
    <Glyph size={12} units={12} className="mt-0.5 shrink-0 text-brand-700 dark:text-brand-400">
      <circle cx="6" cy="6" r="5" />
      <path d="M6 5.4v3M6 3.6h.01" />
    </Glyph>
  );
}

// The quiet bordered button a row's action uses (Change, Open Trash, Turn Off).
export const SETTINGS_ROW_BUTTON =
  'shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60';
