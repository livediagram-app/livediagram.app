'use client';

import { Fragment, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { SettingsPresetSummaryRow } from './SettingsPresetSummaryRow';
import type { SettingsCategoryId } from './settings-icons';

import { SettingsChoiceRow } from './SettingsChoiceRow';
import { SettingsRow } from './SettingsRow';
import { SettingsDeleteAccountRow, SettingsIdentityRow } from './SettingsAccountRows';
import { SettingsShortcutsRow } from './SettingsShortcutsRow';
import { SettingsShortcutListRow } from './SettingsShortcutListRow';
import { SettingsSliderRow } from './SettingsSliderRow';
import { SettingsNoteRow } from './SettingsNoteRow';
import { SettingsLinkRow } from './SettingsLinkRow';
import { SettingsTokensRow } from './SettingsTokensRow';
import { SettingsTrashRow } from './SettingsTrashRow';
import { SettingsCloudSyncRow } from './SettingsCloudSyncRow';
import { SettingsPlacementDefaultRow } from './SettingsPlacementDefaultRow';
import { SettingsSkipLocationRow } from './SettingsSkipLocationRow';
import { usePlacementOptions } from '@/hooks/persistence/usePlacementOptions';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { track } from '@/lib/telemetry';
import { SETTINGS_ROW_ATTRIBUTE } from './settings-scroll-anchor';
import type { AppearanceSetting } from '@livediagram/ui';
import {
  choiceTelemetryType,
  settingsSectionId,
  type SettingsAppearanceRowSpec,
  type SettingsCategorySpec,
  type SettingsRowSpec,
} from './settings-catalogue';
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
  onGoToRow,
  onOpenCategory,
  offeredRowKeys,
  focusSectionId = null,
  owner = null,
}: {
  category: SettingsCategorySpec;
  settings: UserPreferences;
  onChange: (next: UserPreferences) => void;
  // Row to scroll to and ring, when Settings was opened from a search result.
  focusRowKey?: string | null;
  // Go to a row, possibly in another category (the power user preset readout).
  onGoToRow?: (categoryId: SettingsCategoryId, rowKey: string) => void;
  // Open another category in place, for a link row.
  onOpenCategory?: (categoryId: SettingsCategoryId) => void;
  // Row keys the dialog offers right now, across every category.
  offeredRowKeys?: ReadonlySet<string>;
  // Section to scroll to and focus the heading of (settingsSectionId).
  focusSectionId?: string | null;
  // Who is reading: the Documents rows list their folders (docs/specs/013-workspace/default-folders.md).
  owner?: { ownerId: string; clerkUserId: string | null } | null;
}) {
  const isMobile = useIsMobileViewport();
  // The folders the Documents rows choose from and name, fetched only for a pane that shows them.
  const showsDefaults = category.rows.some((r) => r.kind === 'placementDefault');
  const placementLists = usePlacementOptions({
    selfId: owner?.ownerId ?? 'pending',
    clerkUserId: owner?.clerkUserId ?? null,
    skip: useCallback(() => !showsDefaults, [showsDefaults]),
  });
  // Group CONSECUTIVE rows by section, so a category holding several
  // clusters (Editor's Power User rows) gets a heading
  // per cluster instead of one undifferentiated list. Consecutive rather than
  // by-value on purpose: a section that reappeared further down would head
  // itself twice, and the catalogue's order is the intended reading order.
  // A row with a parent in this list renders under it (docs/specs/007-editor/power-user-mode.md#in-settings);
  // one whose parent is not here (a search match) stands on its own.
  const listed = new Set(category.rows.map((r) => r.key));
  const nested = (row: SettingsRowSpec) => !!row.parent && listed.has(row.parent);
  const childrenOf = (row: SettingsRowSpec) => category.rows.filter((r) => r.parent === row.key);
  const groups: { section?: string; rows: typeof category.rows }[] = [];
  for (const row of category.rows.filter((r) => !nested(r))) {
    const last = groups[groups.length - 1];
    if (last && last.section === row.section) last.rows.push(row);
    else groups.push({ section: row.section, rows: [row] });
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group, groupIndex) => (
        <section
          key={group.section ?? groupIndex}
          className="flex flex-col gap-5"
          {...(group.section ? { 'data-settings-section': settingsSectionId(group.section) } : {})}
        >
          {group.section ? (
            <SectionHeading
              name={group.section}
              focused={settingsSectionId(group.section) === focusSectionId}
            />
          ) : null}
          {group.rows.map((row) => {
            const children = childrenOf(row);
            return (
              <Fragment key={row.key}>
                <FocusRing rowKey={row.key} focused={row.key === focusRowKey}>
                  {renderRow(row)}
                </FocusRing>
                {children.length > 0 ? (
                  <div
                    role="group"
                    aria-label={`${row.label} settings`}
                    className="-mt-2 ml-3 flex flex-col gap-5 border-l-2 border-slate-200 pl-4 dark:border-slate-700"
                  >
                    {children.map((child) => (
                      <FocusRing
                        key={child.key}
                        rowKey={child.key}
                        focused={child.key === focusRowKey}
                      >
                        {renderRow(child)}
                      </FocusRing>
                    ))}
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </section>
      ))}
    </div>
  );

  // Fire BEFORE the write so an opt-out event still reaches the wire ahead of
  // the preference that gates it (docs/specs/017-telemetry/telemetry.md).
  function renderRow(row: SettingsCategorySpec['rows'][number]) {
    // A desktop-only row stays visible on a phone but inert, with its note.
    const inert = isMobile && !!row.desktopOnly;
    switch (row.kind) {
      case 'toggle':
        return (
          <SettingsRow
            row={row}
            disabled={inert}
            notice={inert ? row.desktopOnly : undefined}
            checked={row.read(settings)}
            onChange={(next) => {
              track(row.event.category, 'Toggled', next ? row.event.on : row.event.off);
              onChange(row.write(settings, next));
            }}
          />
        );
      case 'choice':
        return (
          <SettingsChoiceRow
            row={row}
            options={row.options.map((o) => ({ ...o, disabled: inert }))}
            notice={inert ? row.desktopOnly : undefined}
            value={row.read(settings)}
            onChange={(next) => {
              track(row.event.category, 'Changed', choiceTelemetryType(row.event.changed, next));
              onChange(row.write(settings, next));
            }}
          />
        );
      case 'slider':
        return (
          <SettingsSliderRow
            row={row}
            disabled={inert}
            notice={inert ? row.desktopOnly : undefined}
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
      case 'link':
        return <SettingsLinkRow row={row} onOpenCategory={onOpenCategory} />;
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
      case 'trash':
        return <SettingsTrashRow row={row} />;
      case 'cloudSync':
        return <SettingsCloudSyncRow row={row} />;
      case 'placementDefault':
        return <SettingsPlacementDefaultRow row={row} lists={placementLists} />;
      case 'skipLocationStep':
        return <SettingsSkipLocationRow row={row} settings={settings} onChange={onChange} />;
      case 'presetSummary':
        return (
          <SettingsPresetSummaryRow
            row={row}
            settings={settings}
            offered={offeredRowKeys}
            onGoToRow={onGoToRow}
          />
        );
    }
  }
}

// A section's heading. When Settings was opened on this section, it scrolls
// to the top of the pane and takes focus, so a keyboard or screen reader user
// lands on it too (docs/specs/007-editor/user-preferences.md).
function SectionHeading({ name, focused }: { name: string; focused: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!focused) return;
    // A frame later: the dialog's focus trap runs after this effect, focuses
    // its first control and remembers what to hand focus back to on close.
    const frame = requestAnimationFrame(() => {
      const heading = ref.current;
      if (!heading) return;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      heading.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      heading.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [focused]);
  return (
    <h3
      ref={ref}
      id={`settings-section-${settingsSectionId(name)}`}
      tabIndex={-1}
      className="-mb-1.5 scroll-mt-2 rounded px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-slate-400"
    >
      {name}
    </h3>
  );
}

// Rings the row a search result pointed at, and scrolls it into view. One
// wrapper for every row kind: the highlight is about WHERE the reader landed,
// not about what the control is, so threading a `focused` prop through six
// components would have been six copies of the same idea.
// It also names the row for the dialog's scroll memory.
function FocusRing({
  rowKey,
  focused,
  children,
}: {
  rowKey: string;
  focused: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focused) return;
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focused]);
  return (
    <div
      ref={ref}
      {...{ [SETTINGS_ROW_ATTRIBUTE]: rowKey }}
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
// UserPreferences (docs/specs/007-editor/live-app.md: a pre-hydration script applies it before first
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
