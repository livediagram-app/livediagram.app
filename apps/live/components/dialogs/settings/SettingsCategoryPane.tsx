'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import { SettingsChoiceRow } from './SettingsChoiceRow';
import { SettingsRow } from './SettingsRow';
import { SettingsDeleteAccountRow, SettingsIdentityRow } from './SettingsAccountRows';
import { SettingsShortcutsRow } from './SettingsShortcutsRow';
import { SettingsShortcutListRow } from './SettingsShortcutListRow';
import { SettingsSliderRow } from './SettingsSliderRow';
import { SettingsNoteRow } from './SettingsNoteRow';
import { SettingsTokensRow } from './SettingsTokensRow';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { track } from '@/lib/telemetry';
import type { AppearanceSetting } from '@/hooks/ui/appearance-store';
import type { SettingsAppearanceRowSpec, SettingsCategorySpec } from './settings-catalogue';
import type { UserPreferences } from '@/lib/user-preferences';

// One category's settings. The pane is deliberately thin: the catalogue says
// which rows exist, what kind of control each needs, and how each reads and
// writes itself, so this only dispatches on kind and fires the row's own
// telemetry token.
export function SettingsCategoryPane({
  category,
  settings,
  onChange,
  focusRowKey = null,
}: {
  category: SettingsCategorySpec;
  settings: UserPreferences;
  onChange: (next: UserPreferences) => void;
  // Row to scroll to and ring, when Settings was opened from a search result.
  focusRowKey?: string | null;
}) {
  const isMobile = useIsMobileViewport();
  // Group CONSECUTIVE rows by section, so a category holding several
  // clusters (Panels covers Layers, Activity and the minimap) gets a heading
  // per cluster instead of one undifferentiated list. Consecutive rather than
  // by-value on purpose: a section that reappeared further down would head
  // itself twice, and the catalogue's order is the intended reading order.
  const groups: { section?: string; rows: typeof category.rows }[] = [];
  for (const row of category.rows) {
    const last = groups[groups.length - 1];
    if (last && last.section === row.section) last.rows.push(row);
    else groups.push({ section: row.section, rows: [row] });
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group, groupIndex) => (
        <section key={group.section ?? groupIndex} className="flex flex-col gap-5">
          {group.section ? (
            <h3 className="-mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group.section}
            </h3>
          ) : null}
          {group.rows.map((row) => (
            <FocusRing key={row.key} focused={row.key === focusRowKey}>
              {renderRow(row)}
            </FocusRing>
          ))}
        </section>
      ))}
    </div>
  );

  // Fire BEFORE the write so an opt-out event still reaches the wire ahead of
  // the preference that gates it (spec/22).
  function renderRow(row: SettingsCategorySpec['rows'][number]) {
    switch (row.kind) {
      case 'toggle':
        return (
          <SettingsRow
            row={row}
            checked={row.read(settings)}
            onChange={(next) => {
              track(row.event.category, 'Toggled', next ? row.event.on : row.event.off);
              onChange(row.write(settings, next));
            }}
          />
        );
      case 'choice': {
        // Desktop-only options stay visible on a phone (so the choice reads
        // the same everywhere) but can't be picked, and a note says why.
        const desktopOnly = row.options.filter((o) => o.desktopOnly);
        const limited = isMobile && desktopOnly.length > 0;
        return (
          <SettingsChoiceRow
            row={row}
            options={row.options.map((o) => ({ ...o, disabled: isMobile && o.desktopOnly }))}
            notice={
              limited
                ? `${joinLabels(desktopOnly.map((o) => o.label))} ${
                    desktopOnly.length === 1 ? 'is' : 'are'
                  } desktop only. On a phone it uses the button bar instead.`
                : undefined
            }
            value={row.read(settings)}
            onChange={(next) => {
              track(row.event.category, 'Changed', choiceTelemetryType(row.event.changed, next));
              onChange(row.write(settings, next));
            }}
          />
        );
      }
      case 'slider':
        return (
          <SettingsSliderRow
            row={row}
            value={row.read(settings)}
            onCommit={(next) => {
              track(row.event.category, 'Changed', row.event.changed);
              onChange(row.write(settings, next));
            }}
          />
        );
      case 'appearance':
        return <AppearanceRow row={row} />;
      case 'tokens':
        return <SettingsTokensRow row={row} />;
      case 'note':
        return <SettingsNoteRow row={row} />;
      case 'shortcuts':
        return <SettingsShortcutsRow row={row} />;
      case 'shortcutList':
        return <SettingsShortcutListRow row={row} />;
      case 'identity':
        return <SettingsIdentityRow row={row} />;
      case 'deleteAccount':
        return <SettingsDeleteAccountRow row={row} />;
    }
  }
}

// Rings the row a search result pointed at, and scrolls it into view. One
// wrapper for every row kind: the highlight is about WHERE the reader landed,
// not about what the control is, so threading a `focused` prop through six
// components would have been six copies of the same idea.
function FocusRing({ focused, children }: { focused: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focused) return;
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focused]);
  return (
    <div
      ref={ref}
      className={
        focused
          ? 'rounded-2xl ring-2 ring-brand-400 ring-offset-4 ring-offset-white dark:ring-offset-slate-900'
          : undefined
      }
    >
      {children}
    </div>
  );
}

const APPEARANCE_OPTIONS = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

// Appearance is the one row backed by its own device-local store rather than
// UserPreferences (spec/07: a pre-hydration script applies it before first
// paint, so it cannot wait on a synced fetch). useAppearance emits the
// telemetry for the change itself, which is why nothing is tracked here.
function AppearanceRow({ row }: { row: SettingsAppearanceRowSpec }) {
  const { setting, set } = useAppearance();
  return (
    <SettingsChoiceRow
      row={row}
      options={APPEARANCE_OPTIONS}
      value={setting}
      onChange={(next) => set(next as AppearanceSetting)}
    />
  );
}

// A choice row's telemetry type carries the option picked, as a toggle's
// carries its new state (spec/22): 'PanelLayout' + 'toolbar' →
// 'PanelLayoutToolbar', so the dashboard shows which way people moved, not
// just that they touched the setting. Option ids are catalogue constants,
// never user content.
function choiceTelemetryType(changed: string, optionId: string): string {
  return `${changed}${optionId.charAt(0).toUpperCase()}${optionId.slice(1)}`;
}

// "Floating", "Floating and Toolbar", "A, B and C".
function joinLabels(labels: string[]): string {
  if (labels.length < 2) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
