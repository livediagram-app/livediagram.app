import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';
import {
  folderNamesInDiagram,
  groupTabsIntoRuns,
  tabFolderName,
  type Tab,
  type TabTimer,
  type TabVote,
  type TextSize,
  type TimerMode,
} from '@livediagram/diagram';
import { useUiMode } from '@/hooks/ui/useUiMode';
import type { Participant } from '@/lib/identity';
import { TabsLabelIcon } from '@/components/chrome/tab-bar-icons';
import { TabFolderChip } from '@/components/chrome/TabFolderChip';
import { useTabReorderDrag } from './useTabReorderDrag';
import { ChromeControls } from '@/components/chrome/ChromeControls';
// Lazy: the tab context menu (and the 18 kB icon module it drags in)
// only loads on the first right-click — it was the largest single
// eager block left in the editor chunk after the dialogs went dynamic.
const PortalMenu = dynamic(() => import('./TabPortalMenu').then((m) => m.PortalMenu));
import { TabPill, type TabPillCtx } from './TabPill';

// Canvas-scoped actions folded into the unified tab / canvas menu: change
// theme / background, and tidy the layout. (Add-element actions used to live
// here too but were removed — the palette + quick-connect cover adding.)
export type CanvasMenuActions = {
  onChangeTheme: () => void;
  onChangeCanvas: () => void;
  // Cleanup category (spec/47): Auto-align grid-snaps current positions;
  // Auto Layout recomputes positions from the arrow graph (Tidy up).
  onAutoAlign: () => void;
  onAutoLayout: () => void;
  // Tab font + default new-element size (spec/28), surfaced as the menu's Font
  // category (moved out of the Tab Appearance modal). `font` null = the editor
  // default; `defaultTextSize` undefined defaults to medium.
  font: string | null;
  onSetFont: (font: string | null) => void;
  defaultTextSize: TextSize | undefined;
  onSetDefaultTextSize: (size: TextSize) => void;
  // Push the tab font + default size onto every existing element on the tab
  // (Font category "Apply to all elements").
  onApplyFontToAll: () => void;
};

// Where the canvas right-click / footer-button menu should open. `openUp`
// grows it upward from y (footer button) rather than down from the cursor.
export type CanvasMenuTarget = { x: number; y: number; openUp?: boolean };

type TabBarProps = {
  // Optional callback that pops the keyboard-shortcuts modal. Lives
  // alongside the dark-mode toggle on the right edge of the bar.
  onOpenShortcuts?: () => void;
  // Optional callback that pops the user-preferences dialog
  // (spec/20). The gear sits between Shortcuts and the dark-mode
  // toggle. Available in every role: even view-role visitors can
  // adjust their own browser-local preferences.
  onOpenSettings?: () => void;
  // Optional callback that pops the global search panel. The
  // button sits to the LEFT of the dark-mode toggle.
  onOpenSearch?: () => void;
  // When set, the active tab's menu opens at this point as the canvas
  // right-click / footer-button menu — the same tab menu with the canvas
  // sections (`canvasActions`) folded in. The page owns the open/close state
  // (shared with element / multi context menus); `onCloseCanvasMenu` dismisses
  // it. Null when no canvas menu is open.
  canvasMenu?: CanvasMenuTarget | null;
  onCloseCanvasMenu?: () => void;
  canvasActions?: CanvasMenuActions;
  tabs: Tab[];
  activeId: string;
  // Folder membership actions (spec/30), menu-only. Move the active tab
  // into a folder by name (new or existing), make it loose again, or
  // rename a folder (rewrites every member).
  onMoveTabToFolder: (tabId: string, folderName: string) => void;
  onRemoveTabFromFolder: (tabId: string) => void;
  onRenameFolder: (oldName: string, newName: string) => void;
  // True when the active tab has at least one element. Used to enable
  // / disable the "Clear content" menu item — disabled on empty tabs
  // so the option is still discoverable but doesn't no-op.
  activeTabHasContent: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  // Wipes every element from the active tab. Undoable. Only exposed
  // through the active tab's ellipsis menu (used to live in the
  // Palette's Content accordion).
  onClearContent: () => void;
  // Active-tab import / export. Surfaced in the ellipsis menu (moved
  // out of the Palette's Import/Export accordion so the per-tab actions
  // all live in one place).
  onImportTab: () => void;
  onExportTab: () => void;
  // Session tools (spec/39) for the active tab, surfaced in its ellipsis
  // menu's Session category — the same advanced SessionToolsSection the
  // canvas context menu uses.
  timer: TabTimer | null;
  vote: TabVote | null;
  onStartTimer: (mode: TimerMode, durationMs?: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onClearTimer: () => void;
  onStartVote: (votesPerPerson: number) => void;
  onEndVote: () => void;
  onRevealVote: () => void;
  onClearVote: () => void;
  // The user's other diagrams (excluding the current one). Drives the
  // "Add to Diagram" submenu in the tab ellipsis.
  otherDiagrams: { id: string; name: string }[];
  // Copy the active tab into another diagram. Callee handles the
  // round-trip to the API. Returns a promise so the menu can dismiss
  // after the operation completes.
  onCopyTabTo: (targetDiagramId: string) => Promise<void> | void;
  // Flip tab.locked. Disables every mutator until toggled back on.
  // The lock icon appears on the tab itself + on every element.
  onToggleLockTab: () => void;
  // Move `sourceId` next to `targetId`. `placeBefore` (default true) picks
  // which side of the target it lands on — the tab bar sets it from the
  // pointer position so the drop matches the insertion caret. Omitting it
  // (folder-chip drop) falls back to inserting before the target.
  onReorder: (sourceId: string, targetId: string, placeBefore?: boolean) => void;
  // True for a view-only ('view' share role) session. Suppresses
  // every mutation affordance on the bar: tab rename (double-click
  // + the ellipsis Rename row), the "+" add button, the whole
  // ellipsis menu (so Duplicate / Clear content / Lock / Move / Delete
  // all vanish), and tab drag-to-reorder. Tab pills remain
  // clickable so the viewer can still navigate between tabs.
  readOnly?: boolean;
  // Bumped by the command palette's "Rename tab" action to inline-rename the
  // ACTIVE tab (the palette can't reach this component's local editing state).
  // A monotonic counter; each increment opens the active tab's name editor.
  renameActiveNonce?: number;
  // Remote participants grouped by which tab they're currently
  // focused on. Each tab in the bar renders the matching avatars so
  // collaborators can see at a glance where everyone is working.
  participantsByTab: Map<string, Participant[]>;
  // Local viewer's identity + role, so the per-tab avatar tooltip can
  // tag the local user with "You" + their role (Viewer / Editor). We
  // can't reliably tag peers with their role yet (the api doesn't
  // broadcast role per ParticipantPresence), so the badge only appears
  // when the participant id matches `selfId`.
  selfId: string;
  selfRole: 'edit' | 'view';
};

export function TabBar({
  tabs,
  activeId,
  onMoveTabToFolder,
  onRemoveTabFromFolder,
  onRenameFolder,
  activeTabHasContent,
  onSelect,
  onAdd,
  onRename,
  onDuplicate,
  onDelete,
  onClearContent,
  onImportTab,
  onExportTab,
  timer,
  vote,
  onStartTimer,
  onPauseTimer,
  onResumeTimer,
  onResetTimer,
  onClearTimer,
  onStartVote,
  onEndVote,
  onRevealVote,
  onClearVote,
  otherDiagrams,
  onCopyTabTo,
  onToggleLockTab,
  onReorder,
  readOnly = false,
  renameActiveNonce = 0,
  participantsByTab,
  selfId,
  selfRole,
  onOpenShortcuts,
  onOpenSettings,
  onOpenSearch,
  canvasMenu,
  onCloseCanvasMenu,
  canvasActions,
}: TabBarProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  // The command palette requests an active-tab rename by bumping
  // renameActiveNonce. Skip the initial 0 so we don't open the editor on
  // mount; ignored for view-only sessions (rename is blocked there).
  useEffect(() => {
    if (renameActiveNonce > 0 && !readOnly) setEditingId(activeId);
  }, [renameActiveNonce, readOnly, activeId]);
  // Drag-reorder machinery (which pill is dragged / hovered + the five
  // per-pill handlers) lives in useTabReorderDrag.
  const reorderDrag = useTabReorderDrag(onReorder);
  // Drives the per-tab accent's legibility guard: the bar is white in
  // light mode, slate-900 in dark, so a stroke that reads on one can
  // vanish on the other.
  const { mode } = useUiMode();
  const isDark = mode === 'dark';

  // Distinct folder names in this diagram, for the "Add to Folder"
  // menu's pick list (spec/30).
  const folderNames = folderNamesInDiagram(tabs);

  // The tab-menu callbacks for a given tab, shared by the per-tab ellipsis
  // menu and the canvas right-click menu so both drive the exact same
  // actions (rename / duplicate / folder / session / ...). `close` differs
  // per surface — the ellipsis closes via setMenuFor, the canvas menu via
  // onCloseCanvasMenu — so each caller passes its own.
  const tabMenuProps = (tab: Tab, close: () => void) => ({
    canDelete: tabs.length > 1,
    canClearContent: activeTabHasContent && !tab.locked,
    locked: tab.locked === true,
    otherDiagrams,
    folderNames,
    currentFolder: tabFolderName(tab),
    onMoveToFolder: (name: string) => {
      onMoveTabToFolder(tab.id, name);
      close();
    },
    onRemoveFromFolder: () => {
      onRemoveTabFromFolder(tab.id);
      close();
    },
    onRename: () => {
      setEditingId(tab.id);
      close();
    },
    onDuplicate: () => {
      onDuplicate(tab.id);
      close();
    },
    onClearContent: () => {
      onClearContent();
      close();
    },
    onImport: () => {
      onImportTab();
      close();
    },
    onExport: () => {
      onExportTab();
      close();
    },
    onCopyTo: async (targetId: string) => {
      await onCopyTabTo(targetId);
      close();
    },
    onToggleLock: () => {
      onToggleLockTab();
      close();
    },
    onDelete: () => {
      onDelete(tab.id);
      close();
    },
    timer,
    vote,
    onStartTimer,
    onPauseTimer,
    onResumeTimer,
    onResetTimer,
    onClearTimer,
    onStartVote,
    onEndVote,
    onRevealVote,
    onClearVote,
  });

  const activeTab = tabs.find((t) => t.id === activeId);

  // One tab pill — see TabPill. The ctx bundle keeps the render
  // callback (shared with TabFolderChip's members) a one-liner.
  const pillCtx: TabPillCtx = {
    activeId,
    editingId,
    setEditingId,
    menuFor,
    setMenuFor,
    readOnly,
    isDark,
    onSelect,
    onRename,
    reorderDrag,
    participantsByTab,
    selfId,
    selfRole,
    canvasActions,
    tabMenuProps,
  };
  const renderTabPill = (tab: Tab): ReactNode => <TabPill key={tab.id} tab={tab} ctx={pillCtx} />;

  return (
    <>
      <div
        data-editor-tabbar
        className="flex h-12 shrink-0 items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <span
          className="hidden items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:flex dark:text-slate-400"
          aria-hidden
        >
          <TabsLabelIcon />
          Tabs
        </span>
        {/* -m-1/p-1 gives the scroll clip 4px of clearance on every side
            without moving the content: the active pill's accent ring and
            drop shadow are box-shadows, which an overflow container clips
            at its padding edge, so with zero padding the ring vanished
            along whichever edges the pill touched (bottom + first pill's
            left). */}
        <div className="scrollbar-slim -m-1 flex flex-1 items-center gap-1 overflow-x-auto p-1">
          {groupTabsIntoRuns(tabs).map((run) =>
            run.kind === 'loose' ? (
              renderTabPill(run.tab)
            ) : (
              <TabFolderChip
                key={`folder:${run.name}`}
                name={run.name}
                tabs={run.tabs}
                activeId={activeId}
                readOnly={readOnly}
                renderTab={renderTabPill}
                onReorder={onReorder}
                onRename={onRenameFolder}
                participantsByTab={participantsByTab}
                selfId={selfId}
                selfRole={selfRole}
              />
            ),
          )}
          {readOnly ? null : (
            <button
              type="button"
              onClick={onAdd}
              aria-label="Add tab"
              className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-lg leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              +
            </button>
          )}
        </div>
        {/* Shared right-hand cluster (search / shortcuts / GitHub / settings
            / dark-mode), reused by the Explorer's bottom bar (spec/07). */}
        <ChromeControls
          onOpenSearch={onOpenSearch}
          onOpenShortcuts={onOpenShortcuts}
          onOpenSettings={onOpenSettings}
          settingsLabel="Diagram settings"
          settingsDescription="Configure per-diagram editor behaviour."
        />
      </div>
      {canvasMenu && !readOnly && activeTab && onCloseCanvasMenu && canvasActions ? (
        <PortalMenu
          point={canvasMenu}
          onClose={onCloseCanvasMenu}
          canvas={canvasActions}
          {...tabMenuProps(activeTab, onCloseCanvasMenu)}
        />
      ) : null}
    </>
  );
}

// UI light / dark mode toggle, pinned to the right edge of the
// TabBar. Distinct from the per-tab diagram theme grid (Palette →
// Theme accordion): this only flips editor chrome, not the canvas.
// Spec/07 "UI light / dark mode" documents the full surface.
