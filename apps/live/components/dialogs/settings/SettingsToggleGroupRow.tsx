'use client';

import { Fragment } from 'react';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsToggleGroupRowSpec } from './settings-catalogue';

// Several related switches as one control (the guided tours, docs/specs/007-editor/user-preferences.md
// "Show Tours"): the group's heading over a grid of switch tiles, one per preference, and the group's one
// description beneath, so three near-identical rows and paragraphs read as one setting with three parts.
export function SettingsToggleGroupRow({
  row,
  checked,
  onChange,
}: {
  row: SettingsToggleGroupRowSpec;
  // Each switch's state, by its key.
  checked: (key: string) => boolean;
  onChange: (key: string, next: boolean) => void;
}) {
  return (
    <SettingsRowShell
      row={row}
      // One "Learn more" per switch that has an article, named by the switch, after the shared description.
      descriptionContent={
        <>
          {row.description}
          {row.toggles.some((t) => t.helpArticle) ? ' Learn more: ' : null}
          {row.toggles
            .filter((t) => t.helpArticle)
            .map((t, i) => (
              <Fragment key={t.key}>
                {i > 0 ? ', ' : null}
                <HelpArticleLink article={t.helpArticle!} variant="text" label={t.label} />
              </Fragment>
            ))}
        </>
      }
      wrapper={(heading) => (
        <div
          role="group"
          aria-label={row.label}
          aria-describedby={`${row.key}-description`}
          className="flex w-full flex-col gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 dark:border-slate-700 dark:bg-slate-800"
        >
          {heading}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {row.toggles.map((toggle) => {
              const on = checked(toggle.key);
              return (
                // The whole tile is the switch, as a toggle row is; the ToggleSwitch is its picture.
                <button
                  key={toggle.key}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  data-settings-toggle={toggle.key}
                  onClick={() => onChange(toggle.key, !on)}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-left transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-900/40 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10"
                >
                  <span className="min-w-0 truncate text-xs font-medium text-slate-700 dark:text-slate-200">
                    {toggle.label}
                  </span>
                  <span aria-hidden>
                    <ToggleSwitch presentational checked={on} label={toggle.label} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    />
  );
}
