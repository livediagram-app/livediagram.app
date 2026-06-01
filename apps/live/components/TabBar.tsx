import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Tab } from '@livediagram/diagram';
import { clampToViewport } from '@/lib/clamp-to-viewport';
import { useUiMode } from '@/hooks/useUiMode';
import type { Participant } from '@/lib/identity';
import { getTheme } from '@/lib/themes';
import { ParticipantAvatar } from './ParticipantAvatar';
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
  // Optional callback that pops the global search panel. The
  // button sits to the LEFT of the dark-mode toggle.
  onOpenSearch?: () => void;
  tabs: Tab[];
  activeId: string;
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
  // The user's other diagrams (excluding the current one). Drives the
  // "Add to another diagram" submenu in the tab ellipsis.
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
};

export function TabBar({
  tabs,
  activeId,
  activeTabHasContent,
  onSelect,
  onAdd,
  onRename,
  onDuplicate,
  onDelete,
  onClearContent,
  otherDiagrams,
  onCopyTabTo,
  onToggleLockTab,
  onReorder,
  readOnly = false,
  participantsByTab,
  onOpenShortcuts,
  onOpenSearch,
}: TabBarProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-t border-slate-200 bg-white px-3 dark:border-slate-800 dark:bg-slate-900">
      <span
        className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
        aria-hidden
      >
        <TabsLabelIcon />
        Tabs
      </span>
      <div className="scrollbar-slim flex flex-1 items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
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
              style={{
                color: tabAccent(tab),
                ...(isActive ? { backgroundColor: `${tabAccent(tab)}1a` } : {}),
              }}
              className={`relative flex shrink-0 items-center gap-3 rounded-md px-2 transition ${
                isActive ? '' : 'hover:bg-slate-100'
              } ${isDragOver ? 'ring-2 ring-brand-400 ring-offset-1' : ''}`}
            >
              {isEditing ? (
                <TabNameEditor
                  initial={tab.name}
                  onCommit={(name) => {
                    onRename(tab.id, name.trim() || tab.name);
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
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
              <TabPresenceStack participants={participantsByTab.get(tab.id) ?? []} />
              {isActive && !isEditing && !readOnly ? (
                <EllipsisMenuButton
                  open={menuFor === tab.id}
                  onToggle={() => setMenuFor(menuFor === tab.id ? null : tab.id)}
                  onClose={() => setMenuFor(null)}
                  canDelete={tabs.length > 1}
                  canClearContent={activeTabHasContent && !tab.locked}
                  locked={tab.locked === true}
                  otherDiagrams={otherDiagrams}
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
                />
              ) : null}
            </div>
          );
        })}
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
            className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <SearchGlyph />
          </button>
        </Tooltip>
      ) : null}
      {onOpenShortcuts ? (
        <Tooltip
          title="Keyboard shortcuts"
          description="See every shortcut. Toggle them off if they get in the way."
        >
          <button
            type="button"
            onClick={onOpenShortcuts}
            aria-label="Keyboard shortcuts"
            className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <KeyboardIcon />
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
        className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
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

function TabNameEditor({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (node) {
      node.focus();
      node.select();
    }
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      className="w-32 rounded-md bg-white px-2 py-1 text-sm font-medium text-slate-800 outline-none ring-1 ring-brand-300"
    />
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
  onRename,
  onDuplicate,
  onClearContent,
  onCopyTo,
  onToggleLock,
  onDelete,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  canDelete: boolean;
  canClearContent: boolean;
  locked: boolean;
  otherDiagrams: { id: string; name: string }[];
  onRename: () => void;
  onDuplicate: () => void;
  onClearContent: () => void;
  onCopyTo: (targetDiagramId: string) => void;
  onToggleLock: () => void;
  onDelete: () => void;
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
          onCopyTo={onCopyTo}
          onToggleLock={onToggleLock}
          locked={locked}
          otherDiagrams={otherDiagrams}
          onDelete={onDelete}
          canDelete={canDelete}
          canClearContent={canClearContent}
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
  onCopyTo,
  onToggleLock,
  locked,
  otherDiagrams,
  onDelete,
  canClearContent,
  canDelete,
}: {
  anchor: HTMLButtonElement | null;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onClearContent: () => void;
  onCopyTo: (targetDiagramId: string) => void;
  onToggleLock: () => void;
  locked: boolean;
  otherDiagrams: { id: string; name: string }[];
  onDelete: () => void;
  canDelete: boolean;
  canClearContent: boolean;
}) {
  // The menu has two views — "actions" lists the verbs (Rename,
  // Duplicate, Clear…), and "copyTo" lists the user's other diagrams
  // so the active tab can be cloned into one of them. Stays in the
  // same portal so the existing positioning and outside-click handler
  // both work unchanged.
  const [view, setView] = useState<'actions' | 'copyTo'>('actions');
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [adjust, setAdjust] = useState({ x: 0, y: 0 });

  // Position above the anchor button, right-aligned to it. Measured each
  // time the menu opens so it stays attached even after layout shifts.
  useEffect(() => {
    if (!anchor) return;
    const update = () => {
      const r = anchor.getBoundingClientRect();
      setPos({ left: r.right, top: r.top });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
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
  }, [pos, view]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target) && e.target !== anchor) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchor]);

  if (typeof document === 'undefined' || !pos) return null;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className={`fixed z-50 flex ${view === 'copyTo' ? 'w-56' : 'w-44'} flex-col rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg`}
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
          <MenuItem
            icon={<TabLockIcon />}
            label={locked ? 'Unlock tab' : 'Lock tab'}
            onClick={onToggleLock}
          />
          <MenuItem icon={<PencilIcon />} label="Rename" onClick={onRename} />
          <MenuItem icon={<CopyIcon />} label="Duplicate" onClick={onDuplicate} />
          <MenuItem
            icon={<MoveIcon />}
            label="Add to another diagram…"
            onClick={() => setView('copyTo')}
            disabled={otherDiagrams.length === 0}
          />
          <MenuItem
            icon={<ClearIcon />}
            label="Clear content"
            onClick={onClearContent}
            disabled={!canClearContent}
          />
          <MenuItem
            icon={<TrashIcon />}
            label="Delete"
            onClick={onDelete}
            danger
            disabled={!canDelete}
          />
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setView('actions')}
            className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-700"
          >
            <BackIcon />
            Back
          </button>
          <p className="px-2 pb-1 text-[10px] text-slate-400">Pick a destination diagram</p>
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
      )}
    </div>,
    document.body,
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const base =
    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium transition';
  const tone = disabled
    ? 'cursor-not-allowed text-slate-300'
    : danger
      ? 'text-rose-700 hover:bg-rose-50'
      : 'text-slate-700 hover:bg-slate-100';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${tone}`}>
      <span className={disabled ? 'text-slate-300' : danger ? 'text-rose-600' : 'text-slate-400'}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

function PencilIcon() {
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
      <path d="M11.5 2.5l2 2-8 8H3.5v-2z" />
      <path d="M10 4l2 2" />
    </svg>
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

function TrashIcon() {
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
      <path d="M2.5 4h11" />
      <path d="M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4" />
      <path d="M4 4l.7 9.1a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" />
    </svg>
  );
}

// Compact stack of participant initials, sitting between the tab
// label and the ellipsis menu. Rendered smaller than the EditorHeader
// avatars so it doesn't dominate the tab. The last avatar uses 0
// negative margin so the stack sits fully inside the pill's right
// padding.
//
// Add / remove are animated: incoming avatars pop in with the brand
// overshoot easing, departing avatars scale out before being dropped
// from the DOM. Tracked in `rendered` state because React unmounts
// the node immediately when props change otherwise — so we hold onto
// leavers long enough to finish their exit transition.
const POP_OUT_MS = 240;

function TabPresenceStack({ participants }: { participants: Participant[] }) {
  type Slot = { p: Participant; leaving: boolean };
  const [rendered, setRendered] = useState<Slot[]>(() =>
    participants.map((p) => ({ p, leaving: false })),
  );

  useEffect(() => {
    const incomingIds = new Set(participants.map((p) => p.id));
    setRendered((prev) => {
      const stable = new Map(prev.map((s) => [s.p.id, s] as const));
      const next: Slot[] = [];
      // Preserve current entries: mark leaving the ones no longer
      // present, refresh the participant payload for the ones that
      // are. Skip already-leaving entries that have since been
      // re-added — the leaving timer below would otherwise yank them
      // back out.
      for (const slot of prev) {
        if (incomingIds.has(slot.p.id)) {
          const fresh = participants.find((p) => p.id === slot.p.id)!;
          next.push({ p: fresh, leaving: false });
        } else if (!slot.leaving) {
          next.push({ p: slot.p, leaving: true });
        } else {
          next.push(slot);
        }
      }
      // Append new arrivals.
      for (const p of participants) {
        if (!stable.has(p.id)) next.push({ p, leaving: false });
      }
      // No-op if nothing actually changed; cheap reference check
      // saves a re-render storm when the parent computes the same
      // identity on every animation frame.
      if (
        next.length === prev.length &&
        next.every((s, i) => s.p === prev[i]!.p && s.leaving === prev[i]!.leaving)
      ) {
        return prev;
      }
      return next;
    });
  }, [participants]);

  useEffect(() => {
    const leavers = rendered.filter((s) => s.leaving);
    if (leavers.length === 0) return;
    const id = window.setTimeout(() => {
      setRendered((prev) => prev.filter((s) => !s.leaving));
    }, POP_OUT_MS);
    return () => window.clearTimeout(id);
  }, [rendered]);

  if (rendered.length === 0) return null;
  // Visible slots — leavers count for layout (they're still
  // animating out) but the overflow badge only considers active
  // arrivals so a departing participant doesn't keep the +N up.
  const active = rendered.filter((s) => !s.leaving);
  const visibleCap = 3;
  const overflow = Math.max(0, active.length - visibleCap);
  const shown = rendered
    .filter((s) => !s.leaving || rendered.indexOf(s) < visibleCap)
    .slice(0, visibleCap + leavingExtra(rendered, visibleCap));
  const slots = overflow > 0 ? shown.length + 1 : shown.length;

  return (
    <div className="flex items-center">
      {shown.map((slot, i) => (
        <span
          key={slot.p.id}
          className={`inline-flex ${i === slots - 1 ? '' : '-mr-0.5'} ${
            slot.leaving ? 'animate-pop-out' : 'animate-pop-in'
          }`}
          style={{ zIndex: slots - i, transformOrigin: 'center' }}
        >
          <ParticipantAvatar participant={slot.p} size={16} withTooltip />
        </span>
      ))}
      {overflow > 0 ? (
        <Tooltip title={`${overflow} more`} description="Other participants on this tab.">
          <span className="inline-flex h-4 w-4 animate-pop-in items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[8px] font-semibold text-slate-600 shadow-sm">
            +{overflow}
          </span>
        </Tooltip>
      ) : null}
    </div>
  );
}

// Helper so the visible slice keeps any leavers that occupy a slot
// inside the cap (so they can finish their exit animation) without
// also showing leavers past the cap.
function leavingExtra(slots: { leaving: boolean }[], cap: number): number {
  let extra = 0;
  let active = 0;
  for (const s of slots) {
    if (active >= cap) break;
    if (s.leaving) extra++;
    else active++;
  }
  return extra;
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
