'use client';

// The Sheet's header (docs/specs/029-sheets/sheet.md "Header"): its title (a double-click renames it in place in
// Plan mode, as a board's: up to 60 characters, unique on the tab), the Sheet Settings cog
// (SheetSettingsPanel; in a Dashboard slot it holds the slot's Slot section too) and Maximise Sheet.
// The header is where the element is moved from: presses on it reach the canvas, except on its controls.
import { useState, type ReactNode } from 'react';
import { SHEET_TITLE_MAX } from '@liveplanner/sheets';
import { MaximisePlanButton } from '@/components/plan/MaximisedPlanLayer';
import { useSheetController } from './sheet-controller';
import { renameSheet } from './sheet-rename';
import { SheetToolbarEnd } from './sheet-toolbar-end';
import { SheetArt } from './sheet-art';
import { SheetSettingsPanel } from './SheetSettingsPanel';
import { SettingsCog } from '@/components/plan/SettingsCog';
import { SLOT_KEEP_OPEN, useSlotSettings } from '@/components/plan/dashboard/slot-menu';
import { useFillsTab } from '@/hooks/plan/plan-cover-store';
import { FocusElementButton } from '@/components/plan/FocusElementButton';
import { IN_BOX_TITLE_CLASS, InMenuBox } from '@/components/plan/menu-name-slot';
import { track } from '@/lib/telemetry';
import type { SheetActions } from './useSheetActions';
import {
  BAND_CONTROLS_CLASS,
  BAND_HEADER_END,
  bandControlsProps,
} from '@/components/plan/band-controls';

export const HEADER_PX = 40;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function SheetHeader({
  elementId,
  bounds,
  actions,
  onImportCsv,
  toolbar,
}: {
  elementId: string;
  // The toolbar, while the Sheet's header holds the top row (docs/specs/029-sheets/sheet.md "Maximised"): between the
  // name (in the menu box) and the controls, in a card of its own.
  toolbar?: ReactNode;
  // The element's box, for Focus.
  bounds?: { x: number; y: number; width: number; height: number };
  actions: SheetActions;
  onImportCsv: () => void;
}) {
  const c = useSheetController();
  const filled = useFillsTab(elementId);
  const slot = useSlotSettings();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(c.sheet.title);

  const rename = () => {
    setRenaming(false);
    renameSheet(c, draft);
  };

  // Focus, Maximise or Restore and the cog (in a Dashboard slot holding the slot's section too): in the header, or ending the toolbar's card in a band.
  const controls = (
    <>
      {bounds && !c.maximised ? (
        <FocusElementButton bounds={bounds} kind="Sheet" palette={c.palette} />
      ) : null}
      {/* A Sheet filling its tab has no Maximise: nothing but turning Fill Tab off puts it back. */}
      {filled ? null : (
        <MaximisePlanButton
          id={elementId}
          kind="Sheet"
          maximised={c.maximised}
          palette={c.palette}
        />
      )}
      {/* The cog last, at the header's far right: the Sheet's one menu, in a Dashboard slot with the slot's Slot
          section after its own (slot-menu.ts). */}
      <SettingsCog
        label="Sheet Settings"
        palette={c.palette}
        onOpen={() => track('Sheet', 'Opened', 'Settings')}
        {...(slot ? { keepOpenWithin: SLOT_KEEP_OPEN } : {})}
      >
        {(close) => (
          <SheetSettingsPanel
            actions={actions}
            onImportCsv={onImportCsv}
            onClose={close}
            csvInTabMenu={filled}
            more={slot ? (section) => slot.sections(section, close) : undefined}
          />
        )}
      </SettingsCog>
    </>
  );

  return (
    <div
      // In a header band (maximised, MaximisedPlanLayer's --plan-band-*), as tall as the top row, after the menu.
      className={`flex h-[var(--plan-band-h,40px)] shrink-0 items-center gap-1.5 border-b pl-[var(--plan-band-left,0.75rem)] pr-3 ${BAND_HEADER_END}`}
      style={{ borderColor: c.palette.cardBorder }}
      onDoubleClick={(e) => {
        // As a board's: a double-click on the title or the header's empty space renames, never on its buttons.
        if (!c.canShape || renaming) return;
        const t = e.target as HTMLElement;
        if (t !== e.currentTarget && !t.closest('[data-sheet-title]')) return;
        e.stopPropagation();
        setDraft(c.sheet.title);
        setRenaming(true);
      }}
    >
      {/* The Sheet's glyph and title; in a header band the title alone rides in the menu box (menu-name-slot), in
          the chrome's ink: the box shows a name, never an icon. */}
      <InMenuBox
        render={(inBox) => (
          <>
            {/* The glyph, so it reads as a spreadsheet at a glance beside the boards (in its own header only). */}
            {inBox ? null : (
              <span aria-hidden className="flex shrink-0" style={{ color: c.palette.focus }}>
                <SheetArt size={15} />
              </span>
            )}
            {renaming ? (
              <input
                autoFocus
                data-keeps-escape
                aria-label="Sheet title"
                maxLength={SHEET_TITLE_MAX}
                value={draft}
                onPointerDown={stop}
                onDoubleClick={stop}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={rename}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') rename();
                  if (e.key === 'Escape') setRenaming(false);
                }}
                className="min-w-0 flex-1 rounded-md border bg-transparent px-1.5 py-0.5 text-[14px] font-semibold outline-none"
                style={{ borderColor: c.palette.focus, color: inBox ? 'inherit' : c.palette.text }}
              />
            ) : (
              // A press on the title moves the element, as on the rest of the header; a double-click renames.
              <div
                data-sheet-title
                // In the menu box a click renames (in the header a press moves the Sheet, a double-click renames).
                onClick={
                  inBox && c.canShape
                    ? () => {
                        setDraft(c.sheet.title);
                        setRenaming(true);
                      }
                    : undefined
                }
                className={
                  inBox
                    ? `${IN_BOX_TITLE_CLASS} ${c.canShape ? 'cursor-text' : ''}`
                    : 'min-w-0 max-w-[var(--plan-band-mid,none)] truncate text-[14px] font-semibold'
                }
                style={inBox ? undefined : { color: c.palette.text }}
              >
                {c.sheet.title}
              </div>
            )}
          </>
        )}
      />
      {toolbar ? (
        // In a header band the controls end the toolbar's card, after Search (sheet-toolbar-end.ts).
        <div className="flex min-w-0 flex-1 justify-start px-3">
          <SheetToolbarEnd.Provider value={c.interactive ? controls : null}>
            {toolbar}
          </SheetToolbarEnd.Provider>
        </div>
      ) : (
        <div className="flex-1" />
      )}
      {c.interactive && !toolbar ? (
        // In a header band, a card like the menu box (band-controls.ts).
        <span
          {...bandControlsProps()}
          className={`flex items-center gap-1 ${BAND_CONTROLS_CLASS}`}
          onPointerDown={stop}
          onDoubleClick={stop}
        >
          {controls}
        </span>
      ) : null}
    </div>
  );
}
