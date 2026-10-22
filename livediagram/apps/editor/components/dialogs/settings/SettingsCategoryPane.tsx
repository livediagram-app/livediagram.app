'use client';

import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccordionSection } from '@/components/primitives/AccordionSection';
import type { HelpArticleKey } from '@/lib/help-articles';
import { SettingsPresetSummaryRow } from './SettingsPresetSummaryRow';
import type { SettingsCategoryId } from './settings-icons';

import { SettingsChoiceRow } from './SettingsChoiceRow';
import { SettingsToggleGroupRow } from './SettingsToggleGroupRow';
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
import { SETTINGS_CARD_SLOT, SettingsGroup, SettingsGroupChildren } from './SettingsGroup';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
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
      {groups.map((group, groupIndex) => {
        const note = group.section ? category.sectionNotes?.[group.section] : undefined;
        if (group.section && category.collapsedSections?.includes(group.section)) {
          // A section people rarely look for, as a closed accordion: opened by its heading, or on its own when
          // Settings was opened on one of its rows or on the section.
          const all = group.rows.flatMap((r) => [r, ...childrenOf(r)]);
          return (
            <CollapsedSection
              key={group.section}
              name={group.section}
              note={note}
              focused={
                settingsSectionId(group.section) === focusSectionId ||
                all.some((r) => r.key === focusRowKey)
              }
              onCount={onCount(all)}
            >
              {renderGroup(group.rows)}
            </CollapsedSection>
          );
        }
        return (
          <section
            key={group.section ?? groupIndex}
            className="flex flex-col gap-2"
            {...(group.section
              ? { 'data-settings-section': settingsSectionId(group.section) }
              : {})}
          >
            {group.section ? (
              <SectionHeading
                name={group.section}
                focused={settingsSectionId(group.section) === focusSectionId}
              />
            ) : null}
            {note ? (
              <p className="-mt-1 px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {note.note}
                {note.helpArticle ? (
                  <>
                    {' '}
                    <HelpArticleLink article={note.helpArticle} variant="text" />
                  </>
                ) : null}
              </p>
            ) : null}
            {renderGroup(group.rows)}
          </section>
        );
      })}
    </div>
  );

  // One section's rows as its card, each nested row beneath its parent.
  function renderGroup(rows: SettingsRowSpec[]) {
    return (
      <SettingsGroup>
        {rows.map((row) => {
          const children = childrenOf(row);
          return (
            <Fragment key={row.key}>
              <FocusRing rowKey={row.key} focused={row.key === focusRowKey}>
                {renderRow(row)}
              </FocusRing>
              {children.length > 0 ? (
                <SettingsGroupChildren label={`${row.label} settings`}>
                  {children.map((child) => (
                    <FocusRing
                      key={child.key}
                      rowKey={child.key}
                      focused={child.key === focusRowKey}
                    >
                      {renderRow(child)}
                    </FocusRing>
                  ))}
                </SettingsGroupChildren>
              ) : null}
            </Fragment>
          );
        })}
      </SettingsGroup>
    );
  }

  // How many of a section's switches are on, for a closed section's heading ("1 of 1 On"): its leaf switches, a
  // parent standing for its children. Null when it holds none.
  function onCount(rows: SettingsRowSpec[]): string | null {
    const leaves = rows.filter(
      (r) => r.kind === 'toggle' && !rows.some((c) => c.parent === r.key),
    ) as Extract<SettingsRowSpec, { kind: 'toggle' }>[];
    if (leaves.length === 0) return null;
    const on = leaves.filter((r) => r.read(settings)).length;
    return `${on} of ${leaves.length} On`;
  }

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
      case 'toggleGroup':
        return (
          <SettingsToggleGroupRow
            row={row}
            checked={(key) => row.toggles.find((t) => t.key === key)!.read(settings)}
            onChange={(key, next) => {
              const toggle = row.toggles.find((t) => t.key === key)!;
              track(toggle.event.category, 'Toggled', next ? toggle.event.on : toggle.event.off);
              onChange(toggle.write(settings, next));
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
      className="scroll-mt-2 rounded px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-slate-400"
    >
      {name}
    </h3>
  );
}

// How long a closed section's body takes to ease open (AccordionSection's duration-short), before it is scrolled to.
const COLLAPSED_SECTION_OPEN_MS = 200;

// A closed accordion section (SettingsCategorySpec.collapsedSections): its heading is the toggle, with the section's
// switch count beside the chevron, so it says what it holds while closed.
function CollapsedSection({
  name,
  note,
  focused,
  onCount,
  children,
}: {
  name: string;
  note?: { note: string; helpArticle?: HelpArticleKey };
  focused: boolean;
  onCount: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(focused);
  const ref = useRef<HTMLElement>(null);
  // Opened by hand, it brings what it unfolded into view once the body has eased open, rather than leaving it
  // below the fold of the pane.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      ref.current?.scrollIntoView?.({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }, COLLAPSED_SECTION_OPEN_MS);
    return () => window.clearTimeout(timer);
  }, [open]);
  // Opened on its own when Settings lands on it, adjusted during render so the row is there to be scrolled to.
  const [wasFocused, setWasFocused] = useState(focused);
  if (focused !== wasFocused) {
    setWasFocused(focused);
    if (focused) setOpen(true);
  }
  return (
    <section
      ref={ref}
      className="flex flex-col"
      data-settings-section={settingsSectionId(name)}
      id={`settings-section-${settingsSectionId(name)}`}
    >
      <AccordionSection
        title={name}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        trailing={
          onCount ? (
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {onCount}
            </span>
          ) : undefined
        }
        headerClassName="flex w-full items-center justify-between rounded px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        bodyClassName="flex flex-col gap-2 pt-1"
      >
        {note ? (
          <p className="px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {note.note}
            {note.helpArticle ? (
              <>
                {' '}
                <HelpArticleLink article={note.helpArticle} variant="text" />
              </>
            ) : null}
          </p>
        ) : null}
        {children}
      </AccordionSection>
    </section>
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
      className={`${SETTINGS_CARD_SLOT} ${focused ? 'ring-2 ring-inset ring-brand-400' : ''}`}
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
// UserPreferences (docs/specs/007-editor/editor-app.md: a pre-hydration script applies it before first
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
