import type { ReactNode, Ref } from 'react';
import {
  DuplicateIcon,
  LockIcon,
  PencilIcon,
  SideBySideIcon,
  TrashIcon,
  lucideGlyph,
} from '@liveworkspace/ui';
import {
  lucideBrushCleaning,
  lucideFileDown,
  lucideFileInput,
  lucideFileUp,
  lucideFolder,
  lucideLink,
} from '@liveworkspace/icons/lucide';
import { MenuActionRow, MenuGroupSeparator } from '../primitives/PortalMenu';
import { MenuToolbar, MenuToolButton } from '../primitives/MenuTiles';
import { MENU_ICON_PX, PasteMenuIcon } from '../palette/context-menu-icons';
import type { ConnectedTabMenu } from '../connect/tab-connection';

// The rows of the one tab menu every editor binds (liveworkspace/docs/specs/022-interface-design/action-parity.md
// "The tab menu"), drawn by TabMenu in its anchored box or a phone's sheet.

// The glyphs, at the sizes each editor's copy drew them: the toolbar's pencil and bin at 13px, the lock at 12px, the
// rows at the menu step.
const RenameGlyph = () => <PencilIcon size={13} />;
const DeleteGlyph = () => <TrashIcon size={13} />;
const LockGlyph = () => <LockIcon size={12} />;
const FolderGlyph = lucideGlyph(lucideFolder, MENU_ICON_PX);
const MoveGlyph = lucideGlyph(lucideFileInput, MENU_ICON_PX);
const ClearGlyph = lucideGlyph(lucideBrushCleaning, MENU_ICON_PX);
const ImportGlyph = lucideGlyph(lucideFileDown, MENU_ICON_PX);
const ExportGlyph = lucideGlyph(lucideFileUp, MENU_ICON_PX);
const ConnectAgainGlyph = lucideGlyph(lucideLink, 16);

// What an app calls one tab ('tab', or liveknowledge's 'page') and what holds its tabs ('canvas', 'plan', ...).
export type TabMenuWords = { item: 'tab' | 'page'; holder: string };

// Every string the menu builds from an app's words, so no row types the noun by hand.
export function tabMenuWords({ item, holder }: TabMenuWords) {
  const Item = item === 'tab' ? 'Tab' : 'Page';
  return {
    menuLabel: `${Item} menu`,
    rename: `Rename this ${item}.`,
    duplicate: `Create a copy of this ${item} in this ${holder}.`,
    paste: `Paste what you copied onto this ${item}.`,
    sideBySideClose: `Go back to one ${item}: this one, across the whole window.`,
    // A tab's pill can be dragged to the right edge; a page has no pill.
    sideBySideOpen: `Show this ${item} on the right, beside the ${item} you were on.${
      item === 'tab' ? ' Or drag its pill to the right edge.' : ''
    }`,
    lock: `Lock ${Item}`,
    unlock: `Unlock ${Item}`,
    lockDescription: `Make this ${item} read-only.`,
    unlockDescription: `Make this ${item} editable again.`,
    delete: `Delete this ${item}.`,
    deleteLocked: `This ${item} is locked. Unlock it before deleting.`,
    confirmDelete: `Delete this ${item}?`,
    remove: `Remove ${Item}`,
  };
}
export type TabMenuStrings = ReturnType<typeof tabMenuWords>;

// The editor's side by side state, read by shape so each editor passes its own SplitView
// (docs/specs/007-editor/split-view.md in each).
export type TabMenuSplit = {
  available: boolean;
  pair: unknown;
  activeId: string;
  canOpen: (tabId: string) => boolean;
  open: (tabId: string, via: 'Menu') => void;
  close: () => void;
};

// Open this (the active) tab side by side, or close the split when one is showing; null where a split can't open (a
// phone, a lone tab, no editor around the menu).
export function sideBySideOf(
  split: TabMenuSplit | null | undefined,
): { closing: boolean; run: () => void } | null {
  if (!split?.available) return null;
  if (split.pair) return { closing: true, run: split.close };
  if (!split.canOpen(split.activeId)) return null;
  return { closing: false, run: () => split.open(split.activeId, 'Menu') };
}

// Paste straight from the menu (docs/specs/008-canvas/canvas-and-palette.md "Canvas menu: Paste" in each editor).
export type TabMenuCanvas = { onPaste: () => void; canPaste: boolean };

// The quick verbs as one icon row. Lock and Delete sit together at the right edge, apart from the everyday verbs:
// both change what the tab will let you do next rather than doing something to it. `spread` (livehuddle, no lock)
// spreads every button evenly across the row instead. The confirm popover anchors to `deleteRowRef`.
export function TabMenuToolbar({
  words,
  spread,
  paste,
  sideBySide,
  locked,
  onToggleLock,
  canDelete,
  onRename,
  onDuplicate,
  onDelete,
  onClose,
  deleteRowRef,
}: {
  words: TabMenuStrings;
  spread: boolean;
  // Paste as a toolbar icon: only from a tab's ⋯ (the canvas right-click has its labelled row instead).
  paste: TabMenuCanvas | null;
  sideBySide: { closing: boolean; run: () => void } | null;
  locked: boolean;
  onToggleLock: (() => void) | undefined;
  canDelete: boolean;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  deleteRowRef: Ref<HTMLDivElement>;
}) {
  const everyday = (
    <>
      <MenuToolButton
        icon={<RenameGlyph />}
        label="Rename"
        description={words.rename}
        onClick={onRename}
      />
      <MenuToolButton
        icon={<DuplicateIcon />}
        label="Duplicate"
        description={words.duplicate}
        onClick={onDuplicate}
      />
      {/* Greyed, not hidden, when the buffer is empty. */}
      {paste ? (
        <MenuToolButton
          icon={<PasteMenuIcon />}
          label="Paste"
          description={paste.canPaste ? words.paste : 'Nothing to paste yet.'}
          onClick={() => {
            paste.onPaste();
            onClose();
          }}
          disabled={!paste.canPaste}
        />
      ) : null}
      {/* Side by side (docs/specs/007-editor/split-view.md): the menu's way to what dragging the pill to the right
        does, for a keyboard or a trackpad that would rather not drag. */}
      {sideBySide ? (
        <MenuToolButton
          icon={<SideBySideIcon />}
          label={sideBySide.closing ? 'Close Side by Side' : 'Side by Side'}
          description={sideBySide.closing ? words.sideBySideClose : words.sideBySideOpen}
          onClick={() => {
            sideBySide.run();
            onClose();
          }}
          active={sideBySide.closing}
        />
      ) : null}
    </>
  );
  const lockButton = onToggleLock ? (
    <MenuToolButton
      icon={<LockGlyph />}
      label={locked ? words.unlock : words.lock}
      description={locked ? words.unlockDescription : words.lockDescription}
      onClick={onToggleLock}
      active={locked}
    />
  ) : null;
  const deleteButton = (
    <MenuToolButton
      icon={<DeleteGlyph />}
      label="Delete"
      description={locked ? words.deleteLocked : words.delete}
      onClick={onDelete}
      disabled={!canDelete || locked}
    />
  );
  return (
    <MenuToolbar>
      {spread ? (
        <div ref={deleteRowRef} className="flex w-full items-center justify-between">
          {everyday}
          {lockButton}
          {deleteButton}
        </div>
      ) : (
        <>
          {everyday}
          <div ref={deleteRowRef} className="ml-auto flex items-center gap-0.5">
            {lockButton}
            {deleteButton}
          </div>
        </>
      )}
    </MenuToolbar>
  );
}

// The rows under the toolbar: Paste from the empty canvas, where the tab lives, what is on it.
export function TabMenuRows({
  pasteRow,
  onClose,
  onOrganise,
  copyTo,
  ownGroup,
  importLabel,
  canImport,
  onImport,
  onExport,
  fileRows,
  canClearContent,
  onClearContent,
}: {
  // The empty-canvas right-click is usually "put what I copied HERE", so there Paste leads the menu as a labelled row.
  pasteRow: TabMenuCanvas | null;
  onClose: () => void;
  onOrganise: (() => void) | null;
  copyTo: { label: string; disabled: boolean; onOpen: () => void } | null;
  ownGroup: ReactNode;
  importLabel: string;
  canImport: boolean;
  onImport: () => void;
  onExport: () => void;
  fileRows: ReactNode;
  canClearContent: boolean;
  onClearContent: () => void;
}) {
  return (
    <>
      {pasteRow ? (
        <>
          <div data-testid="canvas-paste-row">
            <MenuActionRow
              plain
              icon={<PasteMenuIcon />}
              label="Paste"
              disabled={!pasteRow.canPaste}
              onClick={() => {
                pasteRow.onPaste();
                onClose();
              }}
            />
          </div>
          <MenuGroupSeparator />
        </>
      ) : null}
      {/* The rest as full-width rows, no categories: the menu is short enough to show it all
        (docs/specs/007-editor/editor-app.md "Tab menu" in each editor). Separators part the related groups. */}
      {onOrganise ? (
        <MenuActionRow
          plain
          icon={<FolderGlyph />}
          label="Organise in Tab Folder"
          onClick={onOrganise}
        />
      ) : null}
      {copyTo ? (
        <MenuActionRow
          plain
          icon={<MoveGlyph />}
          label={copyTo.label}
          onClick={copyTo.onOpen}
          disabled={copyTo.disabled}
        />
      ) : null}
      {ownGroup ? (
        <>
          <MenuGroupSeparator />
          {ownGroup}
        </>
      ) : null}
      <MenuGroupSeparator />
      <MenuActionRow
        plain
        icon={<ImportGlyph />}
        label={importLabel}
        onClick={onImport}
        disabled={!canImport}
      />
      <MenuActionRow plain icon={<ExportGlyph />} label="Export" onClick={onExport} />
      {fileRows}
      <MenuActionRow
        plain
        icon={<ClearGlyph />}
        label="Clear"
        onClick={onClearContent}
        disabled={!canClearContent}
      />
    </>
  );
}

// A connected tab's menu (liveworkspace/docs/specs/004-index/connected-tabs.md "How it looks"): it has no content, so
// only Rename (where it keeps a name of its own), Connect Again when it opens nothing, its folder, the app's rows and,
// last under a hairline, Remove: four verbs at most, so plain rows (an icon row would hold the bin alone).
export function ConnectedTabMenuRows({
  words,
  connected,
  onRename,
  onOrganise,
  connectedRows,
  canDelete,
  onDelete,
  onClose,
}: {
  words: TabMenuStrings;
  connected: ConnectedTabMenu;
  onRename: (() => void) | null;
  onOrganise: (() => void) | null;
  connectedRows: ReactNode;
  canDelete: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {onRename ? (
        <MenuActionRow plain icon={<RenameGlyph />} label="Rename" onClick={onRename} />
      ) : null}
      {connected.broken ? (
        <MenuActionRow
          plain
          icon={<ConnectAgainGlyph />}
          label="Connect Again"
          onClick={() => {
            connected.onConnectAgain();
            onClose();
          }}
        />
      ) : null}
      {onOrganise ? (
        <MenuActionRow
          plain
          icon={<FolderGlyph />}
          label="Organise in Tab Folder"
          onClick={onOrganise}
        />
      ) : null}
      {connectedRows}
      <MenuGroupSeparator />
      <MenuActionRow
        plain
        icon={<DeleteGlyph />}
        label={words.remove}
        onClick={() => {
          onDelete();
          onClose();
        }}
        disabled={!canDelete}
      />
    </>
  );
}
