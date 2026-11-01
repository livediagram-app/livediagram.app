import { useState } from 'react';

import { PortalMenu } from './TabPortalMenu';
import { EllipsisGlyph } from '@liveworkspace/workbench/components/primitives/EllipsisTriggerButton';
import { MenuErrorBoundary } from '@/components/primitives/MenuErrorBoundary';
import type { CanvasMenuActions } from './TabBar';

// The tab-bar ⋯ button: toggles the unified tab / canvas PortalMenu anchored
// to itself. Extracted from TabBar.tsx. Pure prop-based component.
export function EllipsisMenuButton({
  open,
  onToggle,
  onClose,
  canvas,
  canDelete,
  deleteWarning,
  canClearContent,
  locked,
  otherProjects,
  folderNames,
  currentFolder,
  onMoveToFolder,
  onRemoveFromFolder,
  onRename,
  onDuplicate,
  onClearContent,
  onImport,
  canImport,
  onExport,
  onCopyTo,
  onToggleLock,
  onDelete,
  planTab,
  selfId,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  // The active tab's canvas actions (theme / background / add element). Passed
  // so the tab ellipsis menu renders the SAME Canvas + Add sections as the
  // canvas right-click menu, i.e. one unified menu rather than two.
  canvas?: CanvasMenuActions;
  canDelete: boolean;
  // Delete's warning (deleteTabWarning): the forms sending their responses to this tab are unpublished.
  deleteWarning?: string | undefined;
  canClearContent: boolean;
  locked: boolean;
  // Viewer identity, forwarded to the menu's Add to Project thumbnails.
  selfId: string;
  otherProjects: { id: string; name: string; savedAt?: number }[];
  folderNames: string[];
  currentFolder: string | null;
  onMoveToFolder: (folderName: string) => void;
  onRemoveFromFolder: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onClearContent: () => void;
  onImport: () => void;
  // Whether the Import dialog has anything to press; absent, the tab's lock decides.
  canImport?: boolean;
  onExport: () => void;
  onCopyTo: (targetProjectId: string) => void;
  onToggleLock: () => void;
  onDelete: () => void;
  planTab?: boolean;
}) {
  // In state, so the menu anchors to the button on the render that opens it.
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  return (
    <div>
      <button
        ref={setButton}
        type="button"
        onClick={onToggle}
        aria-label="Tab menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-tour-id="tab-menu-trigger"
        className="relative flex h-6 w-6 touch-target items-center justify-center rounded text-current/70 transition hover:bg-white/40 hover:text-current"
      >
        <EllipsisGlyph />
      </button>
      {open ? (
        <MenuErrorBoundary onError={onClose}>
          <PortalMenu
            anchor={button}
            onClose={onClose}
            canvas={canvas}
            onRename={onRename}
            onDuplicate={onDuplicate}
            onClearContent={onClearContent}
            onImport={onImport}
            {...(canImport === undefined ? {} : { canImport })}
            onExport={onExport}
            onCopyTo={onCopyTo}
            onToggleLock={onToggleLock}
            locked={locked}
            planTab={planTab}
            selfId={selfId}
            otherProjects={otherProjects}
            folderNames={folderNames}
            currentFolder={currentFolder}
            onMoveToFolder={onMoveToFolder}
            onRemoveFromFolder={onRemoveFromFolder}
            onDelete={onDelete}
            canDelete={canDelete}
            deleteWarning={deleteWarning}
            canClearContent={canClearContent}
          />
        </MenuErrorBoundary>
      ) : null}
    </div>
  );
}
