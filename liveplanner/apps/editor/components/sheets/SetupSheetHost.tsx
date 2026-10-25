'use client';

// A Sheet's setup in place of its grid (docs/specs/029-sheets/sheet.md "Setup Sheet"): while it awaits setup with no
// cells, the placeholder; and, for this person only, the Setup Sheet dialog when it is open (placed here, Set up sheet,
// or Sheet Settings' Setup Sheet). The dialog's code loads only when it first opens.
import dynamic from 'next/dynamic';
import { useRef } from 'react';
import { SetupPlaceholder } from '@/components/plan/SetupPlaceholder';
import { useSetupDialog } from '@/components/plan/useSetupDialog';
import { useSheetController } from './sheet-controller';
import { SheetArt } from './sheet-art';

const SheetSetup = dynamic(() => import('./SheetSetup').then((m) => m.SheetSetup), {
  ssr: false,
});

export const SHEET_SET_UP_ELSEWHERE = 'This sheet was just set up by someone else.';

export function SetupSheetHost({
  unset,
  canEdit,
  notify,
  onImportCsv,
}: {
  // Awaiting setup with no cells.
  unset: boolean;
  // May set it up (an Editor, in Plan mode). Anyone else sees the empty grid, never the placeholder.
  canEdit: boolean;
  notify: (message: string) => void;
  onImportCsv: () => void;
}) {
  const c = useSheetController();
  const dialog = useSetupDialog({
    key: c.sheet.id,
    unset,
    canEdit,
    setUpElsewhere: SHEET_SET_UP_ELSEWHERE,
    notify,
  });
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      {unset ? (
        <div className="min-h-0 flex-1">
          <SetupPlaceholder
            ref={button}
            icon={<SheetArt size={20} />}
            title={c.sheet.title}
            action="Set up sheet"
            onAction={dialog.open}
            viewerLine=""
            palette={c.palette}
          />
        </div>
      ) : null}
      {dialog.mode ? (
        <SheetSetup
          onImportCsv={onImportCsv}
          onClose={dialog.close}
          onFinish={dialog.finish}
          // The placeholder's button while it still awaits setup, else the grid.
          returnFocus={() => {
            if (button.current?.isConnected) button.current.focus({ preventScroll: true });
            else c.focusGrid();
          }}
        />
      ) : null}
    </>
  );
}
