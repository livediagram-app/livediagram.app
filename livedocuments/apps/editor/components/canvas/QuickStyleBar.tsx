'use client';

// The Quick Style bar (docs/specs/008-canvas/quick-style-panel.md): the few most-used style choices for the selected
// shapes, arrows and text, as a toolbar card just left of the selection's page's title bar. One button per row, each
// showing its value and opening a popover with the row's choices. On a phone there is no bar: its rows join the page's
// Appearance sheet ("On a phone, in Appearance"), each opening its own bottom sheet.

import { useLayoutEffect, useRef, useState, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { TITLE_BAR_CARD_CLASS } from '@liveworkspace/workbench/components/canvas/PageTitleBar';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import type { QuickSwatchRole, QuickSwatchSlot } from '@livedocuments/document';
import type { QuickStyleApi } from '@/hooks/canvas/useQuickStyle';
import {
  setQuickStyleBarRoom,
  setQuickStylePhoneRows,
  useQuickStyleBarSlot,
} from '@/lib/quick-style-bar-slots';
import { track } from '@/lib/telemetry';
import { SwatchOverridePopover } from '@liveworkspace/workbench/components/canvas/SwatchOverridePopover';
import { TitlePopoverButton, titleButtonClass } from './TitlePopoverButton';
import {
  QUICK_BAR_SECTIONS,
  type QuickSectionId,
  QuickSectionIcon,
  QuickSectionRow,
  sectionOfRole,
  sectionPopoverWidth,
  sectionTitle,
} from './quick-style-sections';

// Screen px between the bar and the title bar (the row's gap), counted in the room the bar takes.
export const QUICK_STYLE_BAR_GAP = 6;

// The swatch whose custom-colour popover is open.
type Editing = { role: QuickSwatchRole; slot: QuickSwatchSlot; anchor: HTMLButtonElement };

// Pressing on the bar must never reach the canvas: no marquee, no pan, no deselect, no tab menu.
const stop = (e: SyntheticEvent) => e.stopPropagation();

export function QuickStyleBar({
  quickStyle,
  pageId,
  hidden,
}: {
  quickStyle: QuickStyleApi;
  // The page the selection is on (quickStyleBarPage).
  pageId: string | null;
  // Zen, embeds, presenting, split view, turned off, or a context menu open: the bar stands down.
  hidden: boolean;
}) {
  const isMobile = useIsMobileViewport();
  const { view } = quickStyle;
  const active = !hidden && view !== null && pageId !== null;
  const slot = useQuickStyleBarSlot(active ? pageId : null);
  const barRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  // On a phone: each row's sheet opens as its count rises (TitlePopoverButton's openRequest).
  const [asks, setAsks] = useState<Partial<Record<QuickSectionId, number>>>({});
  const shown = active && slot !== null;
  const desk = shown && !isMobile;
  const phone = shown && isMobile;
  const sections = view ? QUICK_BAR_SECTIONS.filter((s) => view.sections[s.id] !== undefined) : [];

  // On a phone, the rows its page's Appearance lists, each with its value as its icon; taken back as the bar goes.
  useLayoutEffect(() => {
    if (!phone || !pageId || !view) return;
    setQuickStylePhoneRows(pageId, {
      rows: sections.map((s) => ({
        id: s.id,
        name: s.name,
        line: s.line,
        icon: <QuickSectionIcon id={s.id} view={view} />,
      })),
      open: (id) => {
        const section = QUICK_BAR_SECTIONS.find((s) => s.id === id);
        if (!section) return;
        track('UI', 'Opened', `QuickStyle${section.name}`);
        setAsks((was) => ({ ...was, [section.id]: (was[section.id] ?? 0) + 1 }));
      },
    });
    return () => setQuickStylePhoneRows(pageId, null);
    // oxlint-disable-next-line react/exhaustive-deps -- `sections` follows `view`, so it is keyed on `view`
  }, [phone, pageId, view]);

  // The room it takes beside the title bar, so the page's label truncates to what is left; given back as it goes.
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!desk || !bar || !pageId) return;
    const publish = () => setQuickStyleBarRoom(pageId, bar.offsetWidth + QUICK_STYLE_BAR_GAP);
    publish();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish);
    observer?.observe(bar);
    return () => {
      observer?.disconnect();
      setQuickStyleBarRoom(pageId, 0);
    };
  }, [desk, pageId, slot]);

  // A custom-colour popover outlives neither the bar nor its swatch.
  const editedColours = editing && view ? view.sections[sectionOfRole(editing.role)] : undefined;
  if (editing && (!shown || !editing.anchor.isConnected || !editedColours)) setEditing(null);
  if (!shown || !view) return null;
  const editedSwatch = editing ? editedColours?.swatches[editing.slot] : undefined;
  // A row's choices: in a desktop popover under its title, or alone in a phone's sheet, which the title names.
  const body = (id: QuickSectionId, showTitle: boolean) => (
    <div data-quick-style-popover={id} onContextMenu={(e) => e.preventDefault()}>
      <QuickSectionRow
        id={id}
        view={view}
        quickStyle={quickStyle}
        showTitle={showTitle}
        onEditSwatch={(role, swatchSlot, anchor) => setEditing({ role, slot: swatchSlot, anchor })}
      />
    </div>
  );
  const editor =
    editing && editedSwatch ? (
      <SwatchOverridePopover
        key={`${editing.role}-${editing.slot}`}
        anchor={editing.anchor}
        label={`Custom colour for ${editedSwatch.override?.themeName ?? editedSwatch.name}, ${sectionTitle(sectionOfRole(editing.role))}`}
        colour={editedSwatch.color}
        overridden={editedSwatch.override !== undefined}
        themeNote={`Theme colour: ${editedSwatch.override?.themeName ?? editedSwatch.name}`}
        onSave={(hex) => quickStyle.setSwatchOverride(editing.role, editing.slot, hex)}
        onClear={() => quickStyle.clearSwatchOverride(editing.role, editing.slot)}
        onClose={() => setEditing(null)}
      />
    ) : null;

  if (phone) {
    return createPortal(
      <>
        {sections.map((section) => (
          <TitlePopoverButton
            key={section.id}
            headless
            name={section.title}
            labelled={false}
            className={titleButtonClass}
            icon={null}
            width={sectionPopoverWidth(section.id)}
            openRequest={asks[section.id] ?? 0}
          >
            <div className="px-4">{body(section.id, false)}</div>
          </TitlePopoverButton>
        ))}
        {editor}
      </>,
      slot.el,
    );
  }

  return createPortal(
    <>
      <div
        ref={barRef}
        role="toolbar"
        aria-label="Quick Style"
        data-quick-style-bar=""
        data-testid="quick-style-bar"
        // A guided tour's anchor.
        data-tour-id="quick-style"
        // Working on it keeps an article's toolbar on its page, as the title bar does.
        data-article-keep-active=""
        onPointerDown={stop}
        onDoubleClick={stop}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={`pointer-events-auto flex items-center gap-0.5 motion-safe:animate-fade-in ${TITLE_BAR_CARD_CLASS}`}
      >
        {sections.map((section) => (
          <TitlePopoverButton
            key={section.id}
            name={section.name}
            labelled={slot.named}
            className={titleButtonClass}
            icon={<QuickSectionIcon id={section.id} view={view} />}
            width={sectionPopoverWidth(section.id)}
            onOpen={() => track('UI', 'Opened', `QuickStyle${section.name}`)}
          >
            {body(section.id, true)}
          </TitlePopoverButton>
        ))}
      </div>
      {editor}
    </>,
    slot.el,
  );
}
