'use client';

// The Sheet's header (docs/specs/029-sheets/sheet.md "Header"): its title (a double-click renames it in place in
// Plan mode, as a board's: up to 60 characters, unique on the tab), the Sheet Settings cog
// (SheetSettingsPanel) and Maximise Sheet.
// The header is where the element is moved from: presses on it reach the canvas, except on its controls.
import { useState } from 'react';
import { SHEET_TITLE_MAX } from '@livediagram/sheets';
import { MaximisePlanButton } from '@/components/plan/MaximisedPlanLayer';
import { useSheetController } from './sheet-controller';
import { renameSheet } from './sheet-rename';
import { SheetArt } from './sheet-art';
import { SheetSettingsPanel } from './SheetSettingsPanel';
import { SettingsCog } from '@/components/plan/SettingsCog';
import { useFillsTab } from '@/hooks/plan/plan-cover-store';
import { FocusElementButton } from '@/components/plan/FocusElementButton';
import { track } from '@/lib/telemetry';
import type { SheetActions } from './useSheetActions';

export const HEADER_PX = 40;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function SheetHeader({
  elementId,
  bounds,
  actions,
  onImportCsv,
}: {
  elementId: string;
  // The element's box, for Focus.
  bounds?: { x: number; y: number; width: number; height: number };
  actions: SheetActions;
  onImportCsv: () => void;
}) {
  const c = useSheetController();
  const filled = useFillsTab(elementId);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(c.sheet.title);

  const rename = () => {
    setRenaming(false);
    renameSheet(c, draft);
  };

  return (
    <div
      className="flex shrink-0 items-center gap-1.5 border-b px-3"
      style={{ height: HEADER_PX, borderColor: c.palette.cardBorder }}
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
      {/* The Sheet's glyph, so it reads as a spreadsheet at a glance beside the boards. */}
      <span aria-hidden className="flex shrink-0" style={{ color: c.palette.focus }}>
        <SheetArt size={15} />
      </span>
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
          style={{ borderColor: c.palette.focus, color: c.palette.text }}
        />
      ) : (
        // A press on the title moves the element, as on the rest of the header; a double-click renames.
        <div
          data-sheet-title
          className="min-w-0 truncate text-[14px] font-semibold"
          style={{ color: c.palette.text }}
        >
          {c.sheet.title}
        </div>
      )}
      <div className="flex-1" />
      {c.interactive ? (
        <span className="flex items-center gap-1" onPointerDown={stop} onDoubleClick={stop}>
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
          {/* The cog last, at the header's far right. */}
          <SettingsCog
            label="Sheet Settings"
            palette={c.palette}
            onOpen={() => track('Sheet', 'Opened', 'Settings')}
          >
            {(close) => (
              <SheetSettingsPanel
                elementId={elementId}
                actions={actions}
                onImportCsv={onImportCsv}
                onClose={close}
              />
            )}
          </SettingsCog>
        </span>
      ) : null}
    </div>
  );
}
