import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReposition } from '@/hooks/canvas/useReposition';
import { Portal } from '@/components/primitives/Portal';
import { ConfirmPopover } from '@/components/primitives/ConfirmPopover';
import { type TabTimer, type TabVote, type TimerMode } from '@livediagram/diagram';
import { clampToViewport } from '@/lib/clamp-to-viewport';
import { PencilIcon, TrashIcon } from '@/components/panels/explorer-icons';
import { FileExportIcon, FileImportIcon } from '@/components/palette/palette-icons';
import {
  BackIcon,
  ClearIcon,
  CopyIcon,
  DiagramIcon,
  FolderMenuIcon,
  FolderRemoveIcon,
  MoveIcon,
  TabLockIcon,
} from '@/components/chrome/tab-bar-icons';
import {
  MenuAccordionSection,
  MenuActionButton,
  MenuGroupSeparator,
  MenuItem,
  MenuTile,
  MenuTileGrid,
  MenuToolbar,
  MenuToolButton,
} from '@/components/primitives/PortalMenu';
import {
  AutoAlignIcon,
  AutoLayoutMenuIcon,
  CanvasMenuIcon,
  CleanupMenuIcon,
  FontMenuIcon,
  PaletteMenuIcon,
  TimerMenuIcon,
  VoteMenuIcon,
} from '@/components/palette/context-menu-icons';
import { FontSelect } from '@/components/palette/FontSelect';
import { SizeButton } from '@/components/palette/palette-controls';
import { DotsIcon, ScaleIcon } from '@/components/palette/palette-icons';
import { SessionTimerSection, SessionVoteSection } from '@/components/panels/SessionToolsSection';
import type { CanvasMenuActions, CanvasMenuTarget } from './TabBar';

// The unified tab / canvas portal menu (actions, copy-to-diagram, and
// folder sub-views). Extracted from TabBar.tsx, where it had grown into a
// ~520-line component buried in the file. Pure prop-based component.
export function PortalMenu({
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
        className="lvd-menu-stagger animate-fade-in fixed z-[var(--z-modal)] flex w-56 flex-col rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
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
