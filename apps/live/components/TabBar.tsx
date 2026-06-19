import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { NameEditor } from './NameEditor';
import { useReposition } from '@/hooks/useReposition';
import { Portal } from './Portal';
import { ConfirmPopover } from './ConfirmPopover';
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
import { clampToViewport } from '@/lib/clamp-to-viewport';
import { useUiMode } from '@/hooks/useUiMode';
import type { Participant } from '@/lib/identity';
import { legibleTabAccent } from '@/lib/tab-accent';
import { PencilIcon, TrashIcon } from './explorer-icons';
import { FileExportIcon, FileImportIcon } from './palette-icons';
import {
  BackIcon,
  ClearIcon,
  CopyIcon,
  DiagramIcon,
  FolderMenuIcon,
  FolderRemoveIcon,
  GearIcon,
  GithubIcon,
  KeyboardIcon,
  MoveIcon,
  SearchGlyph,
  TabLockIcon,
  TabsLabelIcon,
} from './tab-bar-icons';
import {
  MenuAccordionSection,
  MenuActionButton,
  MenuGroupSeparator,
  MenuItem,
  MenuTile,
  MenuTileGrid,
  MenuToolbar,
  MenuToolButton,
} from './PortalMenu';
import {
  AutoAlignIcon,
  AutoLayoutMenuIcon,
  CanvasMenuIcon,
  CleanupMenuIcon,
  FontMenuIcon,
  PaletteMenuIcon,
  TimerMenuIcon,
  VoteMenuIcon,
} from './context-menu-icons';
import { FontSelect } from './FontSelect';
import { SizeButton } from './palette-controls';
import { DotsIcon, ScaleIcon } from './palette-icons';
import { SessionTimerSection, SessionVoteSection } from './SessionToolsSection';
import { TabFolderChip } from './TabFolderChip';
import { TabPresenceStack } from './TabPresenceStack';
import { Tooltip } from './Tooltip';

// Canvas-scoped actions folded into the unified tab / canvas menu: change
// theme / background, and tidy the layout. (Add-element actions used to live
// here too but were removed — the palette + quick-connect cover adding.)
type CanvasMenuActions = {
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
type CanvasMenuTarget = { x: number; y: number; openUp?: boolean };

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
  // The current diagram id — used to key per-folder collapse state in
  // localStorage (spec/30) so two diagrams don't share a toggle.
  diagramId: string;
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
  onReorder: (sourceId: string, targetId: string) => void;
  // True for a view-only ('view' share role) session. Suppresses
  // every mutation affordance on the bar: tab rename (double-click
  // + the ellipsis Rename row), the "+" add button, the whole
  // ellipsis menu (so Duplicate / Clear content / Lock / Move / Delete
  // all vanish), and tab drag-to-reorder. Tab pills remain
  // clickable so the viewer can still navigate between tabs.
  readOnly?: boolean;
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
  diagramId,
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
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
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

  // One tab pill. Factored out of the map so loose tabs and folder
  // members (rendered inside TabFolderChip) share the exact same pill —
  // selection, presence, drag-reorder, and the ellipsis menu all behave
  // identically whether or not the tab lives in a folder.
  const renderTabPill = (tab: Tab): ReactNode => {
    const isActive = tab.id === activeId;
    const isEditing = editingId === tab.id;
    const isDragOver = overId === tab.id && dragId && dragId !== tab.id;
    return (
      <div
        key={tab.id}
        draggable={!isEditing && !readOnly}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', tab.id);
          e.dataTransfer.effectAllowed = 'move';
          setDragId(tab.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (overId !== tab.id) setOverId(tab.id);
        }}
        onDragLeave={() => {
          if (overId === tab.id) setOverId(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const src = e.dataTransfer.getData('text/plain');
          if (src && src !== tab.id) onReorder(src, tab.id);
          setDragId(null);
          setOverId(null);
        }}
        onDragEnd={() => {
          setDragId(null);
          setOverId(null);
        }}
        onContextMenu={
          readOnly
            ? undefined
            : (e) => {
                // Right-click ANYWHERE on the tab pill (name, the gap, the
                // presence avatars, the ellipsis) opens the tab menu —
                // not just the name. Previously the handler lived on the
                // name button alone, so a click on the ellipsis or the
                // gap fell through to the browser's own menu. Switch to
                // the clicked tab first (if it isn't active) so the menu's
                // active-tab actions target what the user pointed at.
                e.preventDefault();
                if (!isActive) onSelect(tab.id);
                setMenuFor(tab.id);
              }
        }
        style={{
          color: legibleTabAccent(tab, isDark),
          ...(isActive ? { backgroundColor: `${legibleTabAccent(tab, isDark)}1a` } : {}),
        }}
        className={`relative flex shrink-0 items-center gap-1 rounded-md px-2 transition ${
          isActive ? '' : 'hover:bg-slate-100'
        } ${isDragOver ? 'ring-2 ring-brand-400 ring-offset-1' : ''}`}
      >
        {isEditing ? (
          <NameEditor
            initial={tab.name}
            onCommit={(name) => {
              onRename(tab.id, name.trim() || tab.name);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
            className="w-32 rounded-md bg-white px-2 py-1 text-sm font-medium text-slate-800 outline-none ring-1 ring-brand-300 dark:bg-slate-800 dark:text-slate-100 dark:ring-brand-400"
          />
        ) : (
          <button
            type="button"
            onClick={() => onSelect(tab.id)}
            onDoubleClick={readOnly ? undefined : () => isActive && setEditingId(tab.id)}
            className="flex items-center gap-1 rounded-md py-1.5 text-sm font-medium"
          >
            {tab.locked ? <TabLockIcon /> : null}
            {tab.name}
          </button>
        )}
        <TabPresenceStack
          participants={participantsByTab.get(tab.id) ?? []}
          selfId={selfId}
          selfRole={selfRole}
        />
        {isActive && !isEditing && !readOnly ? (
          <EllipsisMenuButton
            open={menuFor === tab.id}
            onToggle={() => setMenuFor(menuFor === tab.id ? null : tab.id)}
            onClose={() => setMenuFor(null)}
            canvas={canvasActions}
            {...tabMenuProps(tab, () => setMenuFor(null))}
          />
        ) : null}
      </div>
    );
  };

  return (
    <>
      <div
        data-editor-tabbar
        className="flex h-12 shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900"
      >
        <span
          className="hidden items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:flex dark:text-slate-400"
          aria-hidden
        >
          <TabsLabelIcon />
          Tabs
        </span>
        <div className="scrollbar-slim flex flex-1 items-center gap-1 overflow-x-auto">
          {groupTabsIntoRuns(tabs).map((run) =>
            run.kind === 'loose' ? (
              renderTabPill(run.tab)
            ) : (
              <TabFolderChip
                key={`folder:${run.name}`}
                name={run.name}
                tabs={run.tabs}
                activeId={activeId}
                diagramId={diagramId}
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
        {onOpenSearch ? (
          <Tooltip title="Search" description="Find diagrams, folders, tabs and elements.">
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Search"
              className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:ml-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <SearchGlyph />
            </button>
          </Tooltip>
        ) : null}
        {onOpenShortcuts ? (
          <span className="hidden sm:contents">
            <Tooltip
              title="Keyboard shortcuts"
              description="See every shortcut. Toggle them off if they get in the way."
            >
              <button
                type="button"
                onClick={onOpenShortcuts}
                aria-label="Keyboard shortcuts"
                className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:ml-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <KeyboardIcon />
              </button>
            </Tooltip>
          </span>
        ) : null}
        {/* Open-source repo link (the codebase is public + MIT, spec/03).
            Sits just left of Settings; an external <a>, not a callback, so it
            needs no wiring from the editor page. */}
        <Tooltip
          title="Source on GitHub"
          description="View livediagram's open-source code on GitHub."
        >
          <a
            href="https://github.com/livediagram-app/monorepo"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Source on GitHub"
            className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:ml-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <GithubIcon />
          </a>
        </Tooltip>
        {onOpenSettings ? (
          // Settings stays visible on mobile too: it's where users go
          // to flip drawToAdd / arrow-auto-rebind / telemetry opt-out,
          // and there's no other surface for those toggles. Keyboard
          // shortcuts above stay hidden on mobile because they're moot
          // on a touch device, but Settings is a real entry point on
          // every viewport.
          <Tooltip title="Settings" description="Configure per-diagram editor behaviour.">
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label="Diagram settings"
              className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:ml-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <GearIcon />
            </button>
          </Tooltip>
        ) : null}
        <UiModeToggle />
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
function UiModeToggle() {
  const { mode, toggle } = useUiMode();
  const isDark = mode === 'dark';
  return (
    <Tooltip
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      description="Flips the editor chrome. Diagram canvas themes are unaffected."
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={isDark}
        className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:ml-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
    </Tooltip>
  );
}

function MoonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
    </svg>
  );
}

function EllipsisMenuButton({
  open,
  onToggle,
  onClose,
  canvas,
  canDelete,
  canClearContent,
  locked,
  otherDiagrams,
  folderNames,
  currentFolder,
  onMoveToFolder,
  onRemoveFromFolder,
  onRename,
  onDuplicate,
  onClearContent,
  onImport,
  onExport,
  onCopyTo,
  onToggleLock,
  onDelete,
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
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  // The active tab's canvas actions (theme / background / add element). Passed
  // so the tab ellipsis menu renders the SAME Canvas + Add sections as the
  // canvas right-click menu, i.e. one unified menu rather than two.
  canvas?: CanvasMenuActions;
  canDelete: boolean;
  canClearContent: boolean;
  locked: boolean;
  otherDiagrams: { id: string; name: string }[];
  folderNames: string[];
  currentFolder: string | null;
  onMoveToFolder: (folderName: string) => void;
  onRemoveFromFolder: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onClearContent: () => void;
  onImport: () => void;
  onExport: () => void;
  onCopyTo: (targetDiagramId: string) => void;
  onToggleLock: () => void;
  onDelete: () => void;
  // Session tools (spec/39) for this (active) tab's Session category.
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
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        aria-label="Tab menu"
        aria-expanded={open}
        className="flex h-6 w-6 items-center justify-center rounded text-current/70 transition hover:bg-white/40 hover:text-current"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
          <circle cx="3" cy="7" r="1.25" fill="currentColor" />
          <circle cx="7" cy="7" r="1.25" fill="currentColor" />
          <circle cx="11" cy="7" r="1.25" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <PortalMenu
          anchor={buttonRef.current}
          onClose={onClose}
          canvas={canvas}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onClearContent={onClearContent}
          onImport={onImport}
          onExport={onExport}
          onCopyTo={onCopyTo}
          onToggleLock={onToggleLock}
          locked={locked}
          otherDiagrams={otherDiagrams}
          folderNames={folderNames}
          currentFolder={currentFolder}
          onMoveToFolder={onMoveToFolder}
          onRemoveFromFolder={onRemoveFromFolder}
          onDelete={onDelete}
          canDelete={canDelete}
          canClearContent={canClearContent}
          timer={timer}
          vote={vote}
          onStartTimer={onStartTimer}
          onPauseTimer={onPauseTimer}
          onResumeTimer={onResumeTimer}
          onResetTimer={onResetTimer}
          onClearTimer={onClearTimer}
          onStartVote={onStartVote}
          onEndVote={onEndVote}
          onRevealVote={onRevealVote}
          onClearVote={onClearVote}
        />
      ) : null}
    </div>
  );
}

function PortalMenu({
  anchor,
  point,
  canvas,
  onClose,
  onRename,
  onDuplicate,
  onClearContent,
  onImport,
  onExport,
  onCopyTo,
  onToggleLock,
  locked,
  otherDiagrams,
  folderNames,
  currentFolder,
  onMoveToFolder,
  onRemoveFromFolder,
  onDelete,
  canClearContent,
  canDelete,
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
}: {
  // Positioned EITHER above an anchor button (tab ellipsis) OR at a screen
  // point (canvas right-click / footer button). Exactly one is provided.
  anchor?: HTMLButtonElement | null;
  point?: CanvasMenuTarget;
  // When set, the canvas sections (theme / background / add element) render
  // below the tab-management sections, turning the tab menu into the merged
  // canvas right-click menu.
  canvas?: CanvasMenuActions;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onClearContent: () => void;
  onImport: () => void;
  onExport: () => void;
  onCopyTo: (targetDiagramId: string) => void;
  onToggleLock: () => void;
  locked: boolean;
  otherDiagrams: { id: string; name: string }[];
  folderNames: string[];
  currentFolder: string | null;
  onMoveToFolder: (folderName: string) => void;
  onRemoveFromFolder: () => void;
  onDelete: () => void;
  canDelete: boolean;
  canClearContent: boolean;
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
}) {
  // The menu has three views — "actions" lists the verbs (Rename,
  // Duplicate, Clear…), "copyTo" lists the user's other diagrams so the
  // active tab can be cloned into one of them, and "folder" (spec/30)
  // organises the tab into a one-level folder. All stay in the same
  // portal so the existing positioning and outside-click handler both
  // work unchanged.
  const [view, setView] = useState<'actions' | 'copyTo' | 'folder'>('actions');
  const [newFolder, setNewFolder] = useState('');
  // Which collapsible category is open in the actions view — at most one at a
  // time, all closed by default (matches the element context menu).
  const [openSection, setOpenSection] = useState<string | null>(null);
  const sectionProps = (id: string) => ({
    open: openSection === id,
    onToggle: () => setOpenSection((s) => (s === id ? null : id)),
    // Rows sit flush (no per-row hairline); the only rules are the
    // MenuGroupSeparator bands, matching the element context menu.
    flush: true,
  });
  // Delete confirmation: an inline popover anchored to the Delete row
  // (rather than the jarring full-screen modal). Rendered inside this
  // menu's container so the outside-click handler treats it as "inside".
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteRowRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });

  // Position at the given point (canvas right-click / footer button) or, for
  // the tab ellipsis, above the anchor button right-aligned to it. Measured
  // each time the menu opens so it stays attached even after layout shifts.
  useReposition(() => {
    if (point) {
      setPos({ left: point.x, top: point.y });
      return;
    }
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setPos({ left: r.right, top: r.top });
  }, [anchor, point]);

  // After the menu mounts, nudge it back on-screen if it overflows any
  // edge (e.g. Tab 1 is near the left and the menu opens left of its
  // anchor). Also re-runs when `view` flips: the "Add to another
  // diagram" submenu is wider (w-56 vs w-44) and taller (destination
  // list + Back row), so without a fresh measurement the box could
  // overflow the bottom or left edges of the viewport with stale
  // adjust state carried over from the actions view.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !pos) return;
    const next = clampToViewport(node.getBoundingClientRect(), adjust);
    if (next.x !== adjust.x || next.y !== adjust.y) setAdjust(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, view, openSection]);

  useEffect(() => {
    // Grace window after the menu opens during which outside mouse events are
    // ignored. A mobile / iPad long-press opens this menu (the canvas menu)
    // while the finger is still down, and the lift then emits trailing
    // synthetic mouse events at the press point — outside the menu — within a
    // few hundred ms. Without this guard that synthetic mousedown lands on the
    // just-mounted dismiss listener and closes the menu the instant it appears
    // (the bug). Mirrors ContextMenu.tsx's GRACE_MS. Desktop right-click is
    // unaffected: its mousedown fires before the contextmenu that opens the
    // menu, so nothing arrives during the window. Escape (below) is never
    // graced.
    const openedAt = performance.now();
    const GRACE_MS = 400;
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (performance.now() - openedAt < GRACE_MS) return;
      // The delete-confirm popover is portaled outside this menu's DOM,
      // so a click on it would otherwise read as "outside" and close the
      // whole menu before the confirm registers. Treat it as inside.
      const inConfirm =
        e.target instanceof Element && e.target.closest('[data-confirm-popover]') !== null;
      // A mousedown on the button that OPENED this menu (the footer
      // canvas-menu trigger) must not trip the outside-close, or the
      // button's own onClick toggle would just reopen it. The trigger
      // marks itself with data-context-menu-trigger and toggles in onClick.
      const onTrigger =
        e.target instanceof Element && e.target.closest('[data-context-menu-trigger]') !== null;
      if (
        e.target instanceof Node &&
        !ref.current.contains(e.target) &&
        e.target !== anchor &&
        !inConfirm &&
        !onTrigger
      ) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchor]);

  if (!pos) return null;

  return (
    <Portal>
      <div
        ref={ref}
        role="menu"
        onContextMenu={(e) => e.preventDefault()}
        // lvd-menu-stagger cascades the direct children (toolbar + category
        // sections) in one at a time for the same falling-stack entrance the
        // element context menu uses (ContextMenu.tsx); animate-fade-in matches
        // its whole-menu fade. See globals.css.
        className="lvd-menu-stagger animate-fade-in fixed z-50 flex w-56 flex-col rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
        style={{
          // adjust nudges the box back on-screen when it would overflow an edge.
          // Anchor mode pins the menu's right edge to the ellipsis button and
          // grows up-left; point mode pins its top-left to the cursor and grows
          // down (or up from the footer button, which passes openUp).
          left: pos.left + adjust.x,
          top: pos.top + adjust.y,
          transform: point
            ? point.openUp
              ? 'translate(0, calc(-100% - 4px))'
              : 'none'
            : 'translate(-100%, calc(-100% - 4px))',
        }}
      >
        {view === 'actions' ? (
          <>
            {/* Quick actions: the verbs reached for most often, as a compact
                icon row so they're one glance away. The rest of the menu
                groups the verbose / destructive actions into sections. */}
            <MenuToolbar>
              <MenuToolButton
                icon={<PencilIcon />}
                label="Rename"
                description="Rename this tab."
                onClick={onRename}
              />
              <MenuToolButton
                icon={<CopyIcon />}
                label="Duplicate"
                description="Create a copy of this tab in this diagram."
                onClick={onDuplicate}
              />
              <MenuToolButton
                icon={<TabLockIcon />}
                label={locked ? 'Unlock tab' : 'Lock tab'}
                description={locked ? 'Make this tab editable again.' : 'Make this tab read-only.'}
                onClick={onToggleLock}
                active={locked}
              />
              {/* Delete pinned to the right edge of the toolbar, isolated
                  from the everyday verbs; the confirm popover anchors to
                  this wrapper. */}
              <div ref={deleteRowRef} className="ml-auto">
                <MenuToolButton
                  icon={<TrashIcon />}
                  label="Delete"
                  description={
                    locked
                      ? 'This tab is locked. Unlock it before deleting.'
                      : "Delete this tab. Its content can't be recovered."
                  }
                  onClick={() => setConfirmingDelete(true)}
                  danger
                  disabled={!canDelete || locked}
                />
              </div>
            </MenuToolbar>
            {/* Separator under the toolbar, isolating the quick verbs from
                the verbose category bands below. */}
            <MenuGroupSeparator />
            {/* Verbose actions live in collapsible categories (closed by
                default, one open at a time), matching the element menu. */}
            <MenuAccordionSection
              title="Organise"
              icon={<FolderMenuIcon />}
              {...sectionProps('organise')}
            >
              <MenuTileGrid cols={2}>
                <MenuTile
                  icon={<FolderMenuIcon />}
                  label="Add to Folder"
                  onClick={() => {
                    setNewFolder('');
                    setView('folder');
                  }}
                />
                <MenuTile
                  icon={<MoveIcon />}
                  label="Add to Diagram"
                  onClick={() => setView('copyTo')}
                  disabled={otherDiagrams.length === 0}
                />
              </MenuTileGrid>
            </MenuAccordionSection>
            <MenuAccordionSection
              title="Content"
              icon={<FileExportIcon />}
              {...sectionProps('content')}
            >
              <MenuTileGrid cols={3}>
                <MenuTile
                  icon={<FileImportIcon />}
                  label="Import"
                  onClick={onImport}
                  disabled={locked}
                />
                <MenuTile icon={<FileExportIcon />} label="Export" onClick={onExport} />
                <MenuTile
                  icon={<ClearIcon />}
                  label="Clear"
                  danger
                  onClick={onClearContent}
                  disabled={!canClearContent}
                />
              </MenuTileGrid>
            </MenuAccordionSection>
            {/* ── Look & Feel band: theme / background + Font. Rendered
                whenever canvas actions are available, which is now both entry
                points (canvas right-click AND the active tab's ellipsis menu)
                so the two are one unified menu. */}
            {canvas ? (
              <>
                <MenuGroupSeparator />
                <MenuAccordionSection
                  title="Look & Feel"
                  icon={<CanvasMenuIcon />}
                  {...sectionProps('canvas')}
                >
                  <MenuTileGrid cols={2}>
                    <MenuTile
                      icon={<PaletteMenuIcon />}
                      label="Change Theme"
                      onClick={() => {
                        canvas.onChangeTheme();
                        onClose();
                      }}
                    />
                    <MenuTile
                      icon={<CanvasMenuIcon />}
                      label="Change Canvas"
                      onClick={() => {
                        canvas.onChangeCanvas();
                        onClose();
                      }}
                    />
                  </MenuTileGrid>
                </MenuAccordionSection>
                {/* Font (spec/28): the tab's default font + the size seeded onto
                    new elements. Moved out of the Tab Appearance modal so it
                    sits with the other tab-appearance controls. Menu stays open
                    while adjusting so several tweaks land in one visit. */}
                <MenuAccordionSection
                  title="Font"
                  icon={<FontMenuIcon />}
                  {...sectionProps('font')}
                >
                  <div className="flex flex-col gap-2 px-3 py-1.5">
                    <FontSelect
                      value={canvas.font}
                      ariaLabel="Tab font"
                      onChange={canvas.onSetFont}
                    />
                    <div className="grid grid-cols-4 gap-1">
                      {(
                        [
                          ['scale', 'Scale', <ScaleIcon key="s" />],
                          ['sm', 'Small', <DotsIcon key="1" count={1} />],
                          ['md', 'Medium', <DotsIcon key="2" count={2} />],
                          ['lg', 'Large', <DotsIcon key="3" count={3} />],
                        ] as const
                      ).map(([size, label, glyph]) => (
                        <SizeButton
                          key={size}
                          active={(canvas.defaultTextSize ?? 'md') === size}
                          onClick={() => canvas.onSetDefaultTextSize(size)}
                        >
                          <span className="flex flex-col items-center gap-1 py-0.5">
                            {glyph}
                            <span className="text-[10px] font-medium">{label}</span>
                          </span>
                        </SizeButton>
                      ))}
                    </div>
                    {/* Push the tab font + size onto everything already on the
                        tab (clears per-element font overrides so they inherit). */}
                    <MenuActionButton
                      label="Apply to all elements"
                      onClick={() => {
                        canvas.onApplyFontToAll();
                        onClose();
                      }}
                    />
                  </div>
                </MenuAccordionSection>
                {/* ── Cleanup band: layout tidiers (spec/47). Auto-align grid-
                    snaps; Auto Layout recomputes positions from the arrow graph. */}
                <MenuGroupSeparator />
                <MenuAccordionSection
                  title="Cleanup"
                  icon={<CleanupMenuIcon />}
                  {...sectionProps('cleanup')}
                >
                  <MenuTileGrid cols={2}>
                    <MenuTile
                      icon={<AutoLayoutMenuIcon />}
                      label="Auto Layout"
                      onClick={() => {
                        canvas.onAutoLayout();
                        onClose();
                      }}
                    />
                    <MenuTile
                      icon={<AutoAlignIcon />}
                      label="Auto-align"
                      onClick={() => {
                        canvas.onAutoAlign();
                        onClose();
                      }}
                    />
                  </MenuTileGrid>
                </MenuAccordionSection>
              </>
            ) : null}
            {/* ── Session band: Timer + Vote as separate categories ── */}
            <MenuGroupSeparator />
            <MenuAccordionSection title="Timer" icon={<TimerMenuIcon />} {...sectionProps('timer')}>
              <SessionTimerSection
                timer={timer}
                onStartTimer={onStartTimer}
                onPauseTimer={onPauseTimer}
                onResumeTimer={onResumeTimer}
                onResetTimer={onResetTimer}
                onClearTimer={onClearTimer}
              />
            </MenuAccordionSection>
            <MenuAccordionSection title="Vote" icon={<VoteMenuIcon />} {...sectionProps('vote')}>
              <SessionVoteSection
                vote={vote}
                onStartVote={onStartVote}
                onEndVote={onEndVote}
                onRevealVote={onRevealVote}
                onClearVote={onClearVote}
              />
            </MenuAccordionSection>
          </>
        ) : view === 'copyTo' ? (
          <>
            <button
              type="button"
              onClick={() => setView('actions')}
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <BackIcon />
              Back
            </button>
            <p className="px-2 pb-1 text-[10px] text-slate-400 dark:text-slate-400">
              Pick a destination diagram
            </p>
            <div className="max-h-56 overflow-y-auto">
              {otherDiagrams.map((d) => (
                <MenuItem
                  key={d.id}
                  icon={<DiagramIcon />}
                  label={d.name || 'Untitled diagram'}
                  onClick={() => onCopyTo(d.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setView('actions')}
              className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <BackIcon />
              Back
            </button>
            <p className="px-2 pb-1 text-[10px] text-slate-400 dark:text-slate-400">
              Add this tab to a folder
            </p>
            {/* New-folder inline input: Enter (or the + button) commits.
                Typing an existing name just moves the tab into it
                (same name = same folder, spec/30). */}
            <form
              className="flex items-center gap-1 px-2 pb-1"
              onSubmit={(e) => {
                e.preventDefault();
                const name = newFolder.trim();
                if (name) onMoveToFolder(name);
              }}
            >
              <input
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                placeholder="New folder…"
                aria-label="New folder name"
                className="min-w-0 flex-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-800 outline-none ring-brand-300 focus:ring-1 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="submit"
                aria-label="Create folder"
                disabled={!newFolder.trim()}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                +
              </button>
            </form>
            {folderNames.length > 0 ? (
              <div className="max-h-44 overflow-y-auto border-t border-slate-100 pt-1 dark:border-slate-800">
                {folderNames.map((name) => (
                  <MenuItem
                    key={name}
                    icon={<FolderMenuIcon />}
                    label={name === currentFolder ? `${name} (current)` : name}
                    onClick={() => onMoveToFolder(name)}
                    disabled={name === currentFolder}
                  />
                ))}
              </div>
            ) : null}
            {currentFolder ? (
              <div className="border-t border-slate-100 pt-1 dark:border-slate-800">
                <MenuItem
                  icon={<FolderRemoveIcon />}
                  label="Remove from folder"
                  onClick={onRemoveFromFolder}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
      {confirmingDelete && deleteRowRef.current ? (
        <ConfirmPopover
          anchor={deleteRowRef.current}
          message="Delete this tab? Its content can't be recovered."
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete();
            onClose();
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
      ) : null}
    </Portal>
  );
}
