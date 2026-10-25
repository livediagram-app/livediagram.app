'use client';

import { Fragment, memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccordionSection } from './AccordionSection';
import { useSettingsUiKit } from './kit';
import {
  settingsSectionId,
  type SettingsCategory,
  type SettingsRow,
  type SettingsSectionNote,
  type SettingsToggleRow,
} from './model';
import { SettingsChoiceRowView } from './rows/ChoiceRow';
import {
  SettingsLinkRowView,
  SettingsNoteRowView,
  SettingsPresetSummaryRowView,
  SettingsShortcutListRowView,
} from './rows/SimpleRows';
import { SettingsSliderRowView } from './rows/SliderRow';
import { SettingsToggleGroupRowView } from './rows/ToggleGroupRow';
import { SettingsToggleRowView } from './rows/ToggleRow';
import { SETTINGS_ROW_ATTRIBUTE } from './settings-scroll-anchor';
import { SETTINGS_CARD_SLOT, SettingsGroup, SettingsGroupChildren } from './SettingsGroup';

type GoToRow = (categoryId: string, rowKey: string) => void;
type OpenCategory = (categoryId: string) => void;

// One category's settings. The pane is deliberately thin: the model says which rows exist, what
// kind of control each needs and what to do when it changes, so this only groups and dispatches.
export function SettingsCategoryPane({
  category,
  isMobile,
  focusRowKey = null,
  onGoToRow,
  onOpenCategory,
  focusSectionId = null,
}: {
  category: SettingsCategory;
  // A phone: desktop-only rows are inert.
  isMobile: boolean;
  // Row to scroll to and ring, when Settings was opened on it.
  focusRowKey?: string | null;
  // Go to a row, possibly in another category (the power user preset readout). Stable, so the
  // rows it reaches keep their memo.
  onGoToRow?: GoToRow;
  // Open another category in place, for a link row. Stable, likewise.
  onOpenCategory?: OpenCategory;
  // Section to scroll to and focus the heading of (settingsSectionId).
  focusSectionId?: string | null;
}) {
  const { HelpLink } = useSettingsUiKit();
  // Group CONSECUTIVE rows by section, so a category holding several clusters gets a heading per
  // cluster instead of one undifferentiated list. Consecutive rather than by-value on purpose: a
  // section that reappeared further down would head itself twice, and the order given is the
  // intended reading order. A row with a parent in this list renders under it; one whose parent is
  // not here (a search match) stands on its own.
  const listed = new Set(category.rows.map((r) => r.key));
  const nested = (row: SettingsRow) => !!row.parent && listed.has(row.parent);
  const childrenOf = (row: SettingsRow) => category.rows.filter((r) => r.parent === row.key);
  //
  // In All's merged categories an app's own rows (`row.app`) come after the shared ones, as a block under the app's
  // logo and name, with that app's section notes and closed sections.
  type Group = { section?: string; rows: SettingsRow[] };
  const blocks: { app?: string; groups: Group[] }[] = [];
  for (const row of category.rows.filter((r) => !nested(r))) {
    let block = blocks[blocks.length - 1];
    if (!block || block.app !== row.app) {
      block = { ...(row.app !== undefined ? { app: row.app } : {}), groups: [] };
      blocks.push(block);
    }
    const last = block.groups[block.groups.length - 1];
    if (last && last.section === row.section) last.rows.push(row);
    else block.groups.push({ section: row.section, rows: [row] });
  }

  const noteText = (note: SettingsSectionNote) => (
    <>
      {note.note}
      {note.helpArticle && HelpLink ? (
        <>
          {' '}
          <HelpLink article={note.helpArticle} />
        </>
      ) : null}
    </>
  );

  const renderSections = (
    groups: Group[],
    {
      sectionNotes,
      collapsedSections,
      prefix,
      level,
    }: {
      sectionNotes?: SettingsCategory['sectionNotes'];
      collapsedSections?: readonly string[];
      // An app block's: its sections' element ids are its own, and a deep link's section is never one of them.
      prefix: string;
      level: 'h3' | 'h4';
    },
  ) =>
    groups.map((group, groupIndex) => {
      const note = group.section ? sectionNotes?.[group.section] : undefined;
      const sectionId = group.section ? settingsSectionId(group.section) : null;
      const focusable = prefix === '' && sectionId !== null && sectionId === focusSectionId;
      if (group.section && collapsedSections?.includes(group.section)) {
        // A section people rarely look for, as a closed accordion: opened by its heading, or on its own when
        // Settings was opened on one of its rows or on the section.
        const all = group.rows.flatMap((r) => [r, ...childrenOf(r)]);
        return (
          <CollapsedSection
            key={`${prefix}${group.section}`}
            name={group.section}
            id={`${prefix}${sectionId}`}
            note={note ? noteText(note) : undefined}
            focused={focusable || all.some((r) => r.key === focusRowKey)}
            onCount={onCount(all)}
          >
            {renderGroup(group.rows)}
          </CollapsedSection>
        );
      }
      return (
        <section
          key={`${prefix}${group.section ?? groupIndex}`}
          className="flex flex-col gap-2"
          {...(sectionId ? { 'data-settings-section': `${prefix}${sectionId}` } : {})}
        >
          {group.section ? (
            <SectionHeading
              name={group.section}
              id={`${prefix}${sectionId}`}
              level={level}
              focused={focusable}
            />
          ) : null}
          {note ? (
            <p className="-mt-1 px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              {noteText(note)}
            </p>
          ) : null}
          {renderGroup(group.rows)}
        </section>
      );
    });

  return (
    <div className="flex flex-col gap-6">
      {blocks.flatMap((block, blockIndex) => {
        const app = block.app;
        const heading = app !== undefined ? category.appHeadings?.[app] : undefined;
        if (app === undefined || !heading) {
          return renderSections(block.groups, {
            sectionNotes: category.sectionNotes,
            collapsedSections: category.collapsedSections,
            prefix: app !== undefined ? `${settingsSectionId(app)}-` : '',
            level: 'h3',
          });
        }
        const headingId = `settings-app-${settingsSectionId(category.id)}-${settingsSectionId(app)}`;
        return [
          <section
            key={`app:${app}:${blockIndex}`}
            aria-labelledby={headingId}
            data-settings-app={app}
            className="flex flex-col gap-2"
          >
            <AppHeading id={headingId} label={heading.label} icon={heading.icon} />
            <div className="flex flex-col gap-5">
              {renderSections(block.groups, {
                sectionNotes: heading.sectionNotes,
                collapsedSections: heading.collapsedSections,
                prefix: `${settingsSectionId(app)}-`,
                level: 'h4',
              })}
            </div>
          </section>,
        ];
      })}
    </div>
  );

  // One section's rows as its card, each nested row beneath its parent.
  function renderGroup(rows: SettingsRow[]) {
    return (
      <SettingsGroup>
        {rows.map((row) => {
          const children = childrenOf(row);
          return (
            <Fragment key={row.key}>
              <RowSlot
                row={row}
                focused={row.key === focusRowKey}
                isMobile={isMobile}
                onGoToRow={onGoToRow}
                onOpenCategory={onOpenCategory}
              />
              {children.length > 0 ? (
                <SettingsGroupChildren label={`${row.label} settings`}>
                  {children.map((child) => (
                    <RowSlot
                      key={child.key}
                      row={child}
                      focused={child.key === focusRowKey}
                      isMobile={isMobile}
                      onGoToRow={onGoToRow}
                      onOpenCategory={onOpenCategory}
                    />
                  ))}
                </SettingsGroupChildren>
              ) : null}
            </Fragment>
          );
        })}
      </SettingsGroup>
    );
  }
}

// How many of a section's switches are on, for a closed section's heading ("1 of 1 On"): its leaf
// switches, a parent standing for its children. Null when it holds none.
function onCount(rows: SettingsRow[]): string | null {
  const leaves = rows.filter(
    (r): r is SettingsToggleRow => r.kind === 'toggle' && !rows.some((c) => c.parent === r.key),
  );
  if (leaves.length === 0) return null;
  const on = leaves.filter((r) => r.value).length;
  return `${on} of ${leaves.length} On`;
}

// One row in its focus ring. Memoised on the row itself: a row object is rebuilt only when its
// value changes, so a search keystroke (which filters rows without rebuilding them) or another
// row's change leaves it alone.
const RowSlot = memo(function RowSlot({
  row,
  focused,
  isMobile,
  onGoToRow,
  onOpenCategory,
}: {
  row: SettingsRow;
  focused: boolean;
  isMobile: boolean;
  onGoToRow?: GoToRow;
  onOpenCategory?: OpenCategory;
}) {
  return (
    <FocusRing rowKey={row.key} focused={focused}>
      <RowView
        row={row}
        isMobile={isMobile}
        onGoToRow={onGoToRow}
        onOpenCategory={onOpenCategory}
      />
    </FocusRing>
  );
});

function RowView({
  row,
  isMobile,
  onGoToRow,
  onOpenCategory,
}: {
  row: SettingsRow;
  isMobile: boolean;
  onGoToRow?: GoToRow;
  onOpenCategory?: OpenCategory;
}) {
  // A desktop-only row stays visible on a phone but inert, with its note.
  const inert = isMobile && !!row.desktopOnly;
  const notice = inert ? row.desktopOnly : undefined;
  switch (row.kind) {
    case 'toggle':
      return (
        <SettingsToggleRowView
          row={row}
          disabled={inert}
          notice={notice}
          checked={row.value}
          onChange={row.onChange}
        />
      );
    case 'choice':
      return (
        <SettingsChoiceRowView
          row={row}
          options={inert ? row.options.map((o) => ({ ...o, disabled: true })) : row.options}
          notice={notice}
          value={row.value}
          onChange={row.onChange}
        />
      );
    case 'slider':
      return <SettingsSliderRowView row={row} disabled={inert} notice={notice} />;
    case 'toggleGroup':
      return <SettingsToggleGroupRowView row={row} disabled={inert} />;
    case 'link':
      return <SettingsLinkRowView row={row} onOpenCategory={onOpenCategory} />;
    case 'note':
      return <SettingsNoteRowView row={row} />;
    case 'presetSummary':
      return <SettingsPresetSummaryRowView row={row} onGoToRow={onGoToRow} />;
    case 'shortcutList':
      return <SettingsShortcutListRowView row={row} />;
    case 'custom':
      return <>{row.render()}</>;
  }
}

// A section's heading. When Settings was opened on this section, it scrolls
// to the top of the pane and takes focus, so a keyboard or screen reader user
// lands on it too.
function SectionHeading({
  name,
  id,
  level: Heading,
  focused,
}: {
  name: string;
  id: string;
  level: 'h3' | 'h4';
  focused: boolean;
}) {
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
    <Heading
      ref={ref}
      id={`settings-section-${id}`}
      tabIndex={-1}
      className="scroll-mt-2 rounded px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-slate-400"
    >
      {name}
    </Heading>
  );
}

// An app's sub-heading in one of All's merged categories (and the Account section): its Living Prism and name, over
// the rows only that app has.
function AppHeading({ id, label, icon }: { id: string; label: string; icon?: ReactNode }) {
  return (
    <h3
      id={id}
      data-settings-app-heading=""
      className="flex items-center gap-1.5 px-1 pt-1 text-xs font-semibold text-slate-700 dark:text-slate-200"
    >
      {icon ? (
        <span
          aria-hidden
          className="inline-flex size-4 shrink-0 items-center justify-center [&_svg]:size-4"
        >
          {icon}
        </span>
      ) : null}
      <span data-logotype="" className="min-w-0 [overflow-wrap:anywhere]">
        {label}
      </span>
    </h3>
  );
}

// How long a closed section's body takes to ease open (AccordionSection's duration-short), before it is scrolled to.
const COLLAPSED_SECTION_OPEN_MS = 200;

// A closed accordion section (SettingsCategory.collapsedSections): its heading is the toggle, with the section's
// switch count beside the chevron, so it says what it holds while closed.
function CollapsedSection({
  name,
  id,
  note,
  focused,
  onCount,
  children,
}: {
  name: string;
  id: string;
  note?: ReactNode;
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
      data-settings-section={id}
      id={`settings-section-${id}`}
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
          <p className="px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{note}</p>
        ) : null}
        {children}
      </AccordionSection>
    </section>
  );
}

// Rings the row a search result pointed at, and scrolls it into view. One wrapper for every row
// kind: the highlight is about WHERE the reader landed, not about what the control is. It also
// names the row for the dialog's scroll memory.
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
