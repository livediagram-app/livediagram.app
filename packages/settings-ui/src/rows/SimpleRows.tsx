'use client';

import { useState } from 'react';
import { AccordionSection } from '../AccordionSection';
import { useSettingsUiKit } from '../kit';
import type {
  SettingsLinkRow,
  SettingsNoteRow,
  SettingsShortcutListRow,
  SettingsShortcutSection,
} from '../model';
import { SETTINGS_ROW_BUTTON, SettingsRowShell } from '../SettingsRowShell';

// A way into another category of this dialog, opened in place: never a page navigation.
export function SettingsLinkRowView({
  row,
  onOpenCategory,
}: {
  row: SettingsLinkRow;
  onOpenCategory?: (categoryId: string) => void;
}) {
  return (
    <SettingsRowShell
      row={row}
      control={
        onOpenCategory ? (
          <button
            type="button"
            onClick={() => onOpenCategory(row.target)}
            className={SETTINGS_ROW_BUTTON}
          >
            {row.cta}
          </button>
        ) : null
      }
    />
  );
}

// A row with no control, standing in for settings the reader cannot use yet. Same shape as the
// signed-out API tokens row, so "you need an account for this" reads the same wherever it turns
// up, Sign In link included.
export function SettingsNoteRowView({ row }: { row: SettingsNoteRow }) {
  const { SignInLink } = useSettingsUiKit();
  return (
    <SettingsRowShell
      row={row}
      descriptionContent={
        <>
          {row.note}
          {row.signIn && SignInLink ? <SignInLink /> : null}
        </>
      }
    />
  );
}

// Every binding the editor knows, as collapsible groups under the Keyboard category's on/off
// switch.
export function SettingsShortcutListRowView({ row }: { row: SettingsShortcutListRow }) {
  // Single-open accordion, starting on the first group, so the (long) list
  // lands with one group showing and stays compact.
  const [openHeading, setOpenHeading] = useState<string | null>(row.sections[0]?.heading ?? null);
  return (
    <SettingsRowShell row={row}>
      <div className="-mb-2 divide-y divide-slate-100 dark:divide-slate-700">
        {row.sections.map((section) => (
          <ShortcutGroup
            key={section.heading}
            section={section}
            open={openHeading === section.heading}
            onToggle={() => setOpenHeading((h) => (h === section.heading ? null : section.heading))}
          />
        ))}
      </div>
    </SettingsRowShell>
  );
}

function ShortcutGroup({
  section,
  open,
  onToggle,
}: {
  section: SettingsShortcutSection;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <AccordionSection
      title={section.heading}
      open={open}
      onToggle={onToggle}
      titleClassName="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
      chevronClassName="text-slate-400 dark:text-slate-400"
      bodyClassName=""
    >
      <ul className="flex flex-col divide-y divide-slate-100 pb-2 dark:divide-slate-700">
        {/* Keyed by position + label, not keys: one key can do two things
            (Tab selects the next element, and adds a child on a mind node). */}
        {section.rows.map((s, i) => (
          <li
            key={`${i}-${s.label}`}
            className="flex items-center justify-between gap-3 py-1.5 text-xs"
          >
            <span className="text-slate-700 dark:text-slate-200">{s.label}</span>
            <span className="flex shrink-0 items-center gap-1">
              {s.keys.map((k, i) => (
                <kbd
                  key={`${k}-${i}`}
                  className="inline-flex min-w-[1.4rem] items-center justify-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300"
                >
                  {k}
                </kbd>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </AccordionSection>
  );
}
