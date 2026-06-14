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
} from '@livediagram/diagram';
import { clampToViewport } from '@/lib/clamp-to-viewport';
import { useUiMode } from '@/hooks/useUiMode';
import type { Participant } from '@/lib/identity';
import { getTheme } from '@/lib/themes';
import { PencilIcon, TrashIcon } from './explorer-icons';
import { FileExportIcon, FileImportIcon } from './palette-icons';
import { MenuAccordionSection, MenuItem, MenuToolbar, MenuToolButton } from './PortalMenu';
import { TabFolderChip } from './TabFolderChip';
import { TabPresenceStack } from './TabPresenceStack';
import { Tooltip } from './Tooltip';

// Pick the accent colour a tab pill uses to identify itself in the bar.
// Each tab knows its theme id; the theme's `elementStroke` already
// drives the rest of the canvas accent for that tab, so reusing it on
// the pill ties the bar visually to the tab content. Themes without a
// stroke override (e.g. brand) fall through to the palette default so
// the bar still reads.
const DEFAULT_TAB_ACCENT = 'rgb(2 132 199)';
function tabAccent(tab: Tab): string {
  return getTheme(tab.theme).elementStroke ?? DEFAULT_TAB_ACCENT;
}

type TabBarProps = {
  // Optional callback that pops the keyboard-shortcuts modal. Lives
  // alongside the dark-mode toggle on the right edge of the bar.
  onOpenShortcuts?: () => void;
  // Optional callback that pops the user-preferences dialog
  // (spec/20). The gear sits between Shortcuts and the dark-mode
  // toggle. Available in every role: even view-role visitors can
  // adjust their own browser-local preferences.
  onOpenSettings?: () => void;
  // Desktop-only one-click panel-layout toggle (normal ↔ minimal),
  // sitting just left of Settings. `minimalPanels` is the current state
  // (drives the icon + tooltip); omit the toggle to hide the button.
  minimalPanels?: boolean;
  onToggleMinimalPanels?: () => void;
  // Optional callback that pops the global search panel. The
  // button sits to the LEFT of the dark-mode toggle.
  onOpenSearch?: () => void;
  // Optional callback that opens the canvas context menu at a screen point.
  // The trigger sits just right of Search (desktop only — touch users reach
  // it by long-pressing the canvas).
  onOpenCanvasMenu?: (x: number, y: number) => void;
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
  // menu's Session category.
  timerActive: boolean;
  voteActive: boolean;
  onStartTimer: (mode: 'countdown' | 'stopwatch', durationMs?: number) => void;
  onClearTimer: () => void;
  onStartVote: (votesPerPerson: number) => void;
  onEndVote: () => void;
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
  timerActive,
  voteActive,
  onStartTimer,
  onClearTimer,
  onStartVote,
  onEndVote,
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
  onOpenCanvasMenu,
  minimalPanels,
  onToggleMinimalPanels,
  onOpenSearch,
}: TabBarProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Distinct folder names in this diagram, for the "Add to Folder"
  // menu's pick list (spec/30).
  const folderNames = folderNamesInDiagram(tabs);

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
          color: tabAccent(tab),
          ...(isActive ? { backgroundColor: `${tabAccent(tab)}1a` } : {}),
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
            canDelete={tabs.length > 1}
            canClearContent={activeTabHasContent && !tab.locked}
            locked={tab.locked === true}
            otherDiagrams={otherDiagrams}
            folderNames={folderNames}
            currentFolder={tabFolderName(tab)}
            onMoveToFolder={(name) => {
              onMoveTabToFolder(tab.id, name);
              setMenuFor(null);
            }}
            onRemoveFromFolder={() => {
              onRemoveTabFromFolder(tab.id);
              setMenuFor(null);
            }}
            onRename={() => {
              setEditingId(tab.id);
              setMenuFor(null);
            }}
            onDuplicate={() => {
              onDuplicate(tab.id);
              setMenuFor(null);
            }}
            onClearContent={() => {
              onClearContent();
              setMenuFor(null);
            }}
            onImport={() => {
              onImportTab();
              setMenuFor(null);
            }}
            onExport={() => {
              onExportTab();
              setMenuFor(null);
            }}
            onCopyTo={async (targetId) => {
              await onCopyTabTo(targetId);
              setMenuFor(null);
            }}
            onToggleLock={() => {
              onToggleLockTab();
              setMenuFor(null);
            }}
            onDelete={() => {
              onDelete(tab.id);
              setMenuFor(null);
            }}
            timerActive={timerActive}
            voteActive={voteActive}
            onStartTimer={onStartTimer}
            onClearTimer={onClearTimer}
            onStartVote={onStartVote}
            onEndVote={onEndVote}
          />
        ) : null}
      </div>
    );
  };

  return (
    <div
      data-editor-tabbar
      className="flex h-12 shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <span
        className="hidden items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:flex dark:text-slate-500"
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
      {onToggleMinimalPanels ? (
        // Desktop only: minimal mode is forced on mobile, so the toggle is
        // moot there.
        <span className="hidden sm:contents">
          <Tooltip
            title={minimalPanels ? 'Normal panels' : 'Minimal panels'}
            description={
              minimalPanels
                ? 'Switch back to the floating Palette / Explorer panels.'
                : 'Collapse the panels into a compact button bar.'
            }
          >
            <button
              type="button"
              onClick={onToggleMinimalPanels}
              aria-label={minimalPanels ? 'Use normal panel layout' : 'Use minimal panel layout'}
              aria-pressed={!!minimalPanels}
              className={`ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition sm:ml-1 ${
                minimalPanels
                  ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              <PanelLayoutIcon />
            </button>
          </Tooltip>
        </span>
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
      {onOpenCanvasMenu ? (
        <span className="hidden sm:contents">
          <Tooltip
            title="Canvas menu"
            description="Theme, background, add elements, session tools."
          >
            <button
              type="button"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                // Anchor the menu's BOTTOM edge at the button's top (openUp),
                // so it opens above the footer rather than over it.
                onOpenCanvasMenu(r.left, r.top);
              }}
              aria-label="Canvas menu"
              className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:ml-1 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <CanvasGlyph />
            </button>
          </Tooltip>
        </span>
      ) : null}
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
  );
}

function SearchGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="7" cy="7" r="4" />
      <path d="M10 10l3.5 3.5" />
    </svg>
  );
}

// Dotted-canvas glyph for the canvas-menu trigger.
function CanvasGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
      <circle cx="6" cy="6" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="10" cy="6" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="6" cy="10" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="10" cy="10" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="5.5" width="16" height="10" rx="1.5" />
      <path d="M5 9h.01M8 9h.01M11 9h.01M14 9h.01M5 12.5h10" />
    </svg>
  );
}

// A panel layout glyph: a frame with a sidebar, hinting "panels".
function PanelLayoutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <path d="M8 4v12" />
    </svg>
  );
}

function GearIcon() {
  // Sliders silhouette (two horizontal sliders with a knob on each)
  // instead of the cog that previously sat here. The cog's 8 spokes
  // around a central circle read as a sun on most rendering sizes,
  // especially in dark mode where the stroke is light, which made
  // the Settings button look like an alternate dark-mode toggle.
  // The sliders glyph is the standard "settings" affordance in
  // modern UI kits (Heroicons, Lucide, Material) and reads as
  // "settings" without ambiguity.
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="3" y1="6" x2="11" y2="6" />
      <line x1="16" y1="6" x2="17.5" y2="6" />
      <circle cx="13.5" cy="6" r="2" />
      <line x1="3" y1="14" x2="6" y2="14" />
      <line x1="11" y1="14" x2="17.5" y2="14" />
      <circle cx="8.5" cy="14" r="2" />
    </svg>
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
  timerActive,
  voteActive,
  onStartTimer,
  onClearTimer,
  onStartVote,
  onEndVote,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
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
  timerActive: boolean;
  voteActive: boolean;
  onStartTimer: (mode: 'countdown' | 'stopwatch', durationMs?: number) => void;
  onClearTimer: () => void;
  onStartVote: (votesPerPerson: number) => void;
  onEndVote: () => void;
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
          timerActive={timerActive}
          voteActive={voteActive}
          onStartTimer={onStartTimer}
          onClearTimer={onClearTimer}
          onStartVote={onStartVote}
          onEndVote={onEndVote}
        />
      ) : null}
    </div>
  );
}

function PortalMenu({
  anchor,
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
  timerActive,
  voteActive,
  onStartTimer,
  onClearTimer,
  onStartVote,
  onEndVote,
}: {
  anchor: HTMLButtonElement | null;
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
  timerActive: boolean;
  voteActive: boolean;
  onStartTimer: (mode: 'countdown' | 'stopwatch', durationMs?: number) => void;
  onClearTimer: () => void;
  onStartVote: (votesPerPerson: number) => void;
  onEndVote: () => void;
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
    // Desktop: hovering a category switches to it automatically.
    onHoverOpen: () => setOpenSection(id),
  });
  // Delete confirmation: an inline popover anchored to the Delete row
  // (rather than the jarring full-screen modal). Rendered inside this
  // menu's container so the outside-click handler treats it as "inside".
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const deleteRowRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });

  // Position above the anchor button, right-aligned to it. Measured each
  // time the menu opens so it stays attached even after layout shifts.
  useReposition(() => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setPos({ left: r.right, top: r.top });
  }, [anchor]);

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
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      // The delete-confirm popover is portaled outside this menu's DOM,
      // so a click on it would otherwise read as "outside" and close the
      // whole menu before the confirm registers. Treat it as inside.
      const inConfirm =
        e.target instanceof Element && e.target.closest('[data-confirm-popover]') !== null;
      if (
        e.target instanceof Node &&
        !ref.current.contains(e.target) &&
        e.target !== anchor &&
        !inConfirm
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchor]);

  if (!pos) return null;

  return (
    <Portal>
      <div
        ref={ref}
        role="menu"
        className={`fixed z-50 flex ${view === 'actions' ? 'w-44' : 'w-56'} flex-col rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40`}
        style={{
          // pos pins the menu's right edge to the ellipsis button's right edge,
          // then translate shifts it left and up. adjust nudges back on-screen
          // when the menu would otherwise overflow a viewport edge.
          left: pos.left + adjust.x,
          top: pos.top + adjust.y,
          transform: 'translate(-100%, calc(-100% - 4px))',
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
            {/* Verbose actions live in collapsible categories (closed by
                default, one open at a time), matching the element menu. */}
            <MenuAccordionSection
              title="Organise"
              icon={<FolderMenuIcon />}
              {...sectionProps('organise')}
            >
              <MenuItem
                icon={<FolderMenuIcon />}
                label="Add to Folder"
                onClick={() => {
                  setNewFolder('');
                  setView('folder');
                }}
              />
              <MenuItem
                icon={<MoveIcon />}
                label="Add to Diagram"
                onClick={() => setView('copyTo')}
                disabled={otherDiagrams.length === 0}
              />
            </MenuAccordionSection>
            <MenuAccordionSection
              title="Content"
              icon={<FileExportIcon />}
              {...sectionProps('content')}
            >
              <MenuItem
                icon={<FileImportIcon />}
                label="Import Content"
                onClick={onImport}
                disabled={locked}
              />
              <MenuItem icon={<FileExportIcon />} label="Export Contents" onClick={onExport} />
              <MenuItem
                icon={<ClearIcon />}
                label="Reset Canvas"
                onClick={onClearContent}
                disabled={!canClearContent}
              />
            </MenuAccordionSection>
            <MenuAccordionSection
              title="Session"
              icon={<SessionTabIcon />}
              {...sectionProps('session')}
            >
              {timerActive ? (
                <MenuItem
                  icon={<SessionTabIcon />}
                  label="Stop timer"
                  onClick={() => {
                    onClearTimer();
                    onClose();
                  }}
                />
              ) : (
                <>
                  <MenuItem
                    icon={<SessionTabIcon />}
                    label="Start countdown (5 min)"
                    onClick={() => {
                      onStartTimer('countdown', 5 * 60_000);
                      onClose();
                    }}
                  />
                  <MenuItem
                    icon={<SessionTabIcon />}
                    label="Start stopwatch"
                    onClick={() => {
                      onStartTimer('stopwatch');
                      onClose();
                    }}
                  />
                </>
              )}
              {voteActive ? (
                <MenuItem
                  icon={<VoteTabIcon />}
                  label="End voting"
                  onClick={() => {
                    onEndVote();
                    onClose();
                  }}
                />
              ) : (
                <MenuItem
                  icon={<VoteTabIcon />}
                  label="Start voting"
                  onClick={() => {
                    onStartVote(3);
                    onClose();
                  }}
                />
              )}
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
            <p className="px-2 pb-1 text-[10px] text-slate-400 dark:text-slate-500">
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
            <p className="px-2 pb-1 text-[10px] text-slate-400 dark:text-slate-500">
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

function CopyIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="8" height="8" rx="1.25" />
      <path d="M5.5 13.5h6a1 1 0 0 0 1-1v-6" />
    </svg>
  );
}

function TabLockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="7.5" width="9" height="6" rx="1.25" />
      <path d="M5.5 7.5V5a2.5 2.5 0 0 1 5 0v2.5" />
    </svg>
  );
}

function FolderMenuIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 4.5h4l1.25 1.5H14v6.5H2z" />
    </svg>
  );
}

function FolderRemoveIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 4.5h4l1.25 1.5H14v6.5H2z" />
      <path d="M6 9.5h4" />
    </svg>
  );
}

function MoveIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="7" height="9" rx="1.25" />
      <path d="M9.5 8.5h4.5" />
      <path d="M12 6.5l2 2-2 2" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 2L3 6L7 10" />
    </svg>
  );
}

function DiagramIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M5 6h6M5 9h4" />
    </svg>
  );
}

// Tiny folder-tab-stack icon paired with the TABS label. Reads as
// "tabs of paper" — disambiguates the label from the canvas's own
// shape tooling at a glance.
function TabsLabelIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1.5 4.5h3l1 1.25h5v4.25h-9z" />
      <path d="M3 4.5V3h3.25" />
    </svg>
  );
}

// Clock face — the Session timer rows.
function SessionTabIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8.5" r="5.5" />
      <path d="M8 5.5V8.5L10 10M8 2.5V1" />
    </svg>
  );
}

// Three dots — the voting rows.
function VoteTabIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="4.5" cy="8" r="1.6" />
      <circle cx="8" cy="8" r="1.6" />
      <circle cx="11.5" cy="8" r="1.6" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
    </svg>
  );
}
