'use client';

import { useState } from 'react';
import { AccordionSection } from '@/components/primitives/AccordionSection';
import { SHORTCUT_SECTIONS, type ShortcutSection } from '@/components/dialogs/shortcut-sections';
import { SettingsRowShell } from './SettingsRowShell';
import type { SettingsShortcutListRowSpec } from './settings-catalogue';

// Every binding the editor knows, as collapsible groups under the Keyboard
// category's on/off switch. This was the Keyboard Shortcuts window, reached
// from its own tab-bar button; it moved here so the list and the switch that
// turns it off share one screen (docs/specs/008-canvas/canvas-and-palette.md).
export function SettingsShortcutListRow({ row }: { row: SettingsShortcutListRowSpec }) {
  // Single-open accordion, starting on the first group, so the (long) list
  // lands with one group showing and stays compact.
  const [openHeading, setOpenHeading] = useState<string | null>(
    SHORTCUT_SECTIONS[0]?.heading ?? null,
  );
  return (
    <SettingsRowShell
      row={row}
      wrapper={(label) => (
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white px-3.5 pt-3 pb-1 dark:border-slate-700 dark:bg-slate-800">
          {label}
          <div className="mt-1 divide-y divide-slate-100 dark:divide-slate-700">
            {SHORTCUT_SECTIONS.map((section) => (
              <ShortcutGroup
                key={section.heading}
                section={section}
                open={openHeading === section.heading}
                onToggle={() =>
                  setOpenHeading((h) => (h === section.heading ? null : section.heading))
                }
              />
            ))}
          </div>
        </div>
      )}
    />
  );
}

function ShortcutGroup({
  section,
  open,
  onToggle,
}: {
  section: ShortcutSection;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <AccordionSection
      title={section.heading}
      open={open}
      onToggle={onToggle}
      titleClassName="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400"
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
