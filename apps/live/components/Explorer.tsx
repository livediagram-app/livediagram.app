'use client';

import { useEffect, useRef, useState } from 'react';
import { formatRelativeTime, useRelativeTimeTick } from '@/lib/relative-time';
import { MovablePanel } from './MovablePanel';
import { MenuItem, PortalMenu } from './PortalMenu';

type DiagramListItem = {
  id: string;
  name: string;
  savedAt: number;
};

type ExplorerProps = {
  position: { x: number; y: number } | null;
  minimized: boolean;
  // Every diagram known to the local store. Current diagram is marked
  // active; clicking any other navigates to it (preserving the
  // current's state via the auto-save).
  diagrams: DiagramListItem[];
  // True while the initial diagram-list fetch is in flight. Shows a
  // skeleton in place of the list so the panel doesn't read as "no
  // diagrams" before the API call resolves.
  loading: boolean;
  currentDiagramId: string | null;
  onMoveTo: (x: number, y: number) => void;
  onToggleMinimized: () => void;
  onReset: () => void;
  onOpenDiagram: (id: string) => void;
  // Optional so consumers that have nowhere to mint a new diagram
  // (e.g. the welcome route, which IS the new-diagram flow) can hide
  // the button entirely. When omitted the row isn't rendered.
  onNewDiagram?: () => void;
  // Optional row-level actions. When provided, each row renders an
  // ellipsis menu that delegates to these handlers. Omitted on
  // surfaces where the editor's helpers aren't reachable (or shouldn't
  // be) — read-only contexts, for example.
  onRenameCurrent?: (name: string) => void;
  onDeleteDiagram?: (id: string) => void;
  onDuplicateDiagram?: (id: string) => void;
};

// Floating "Explorer" panel pinned to the top-left of the canvas by
// default. Symmetric to the Palette in shape and behaviour.
//
// In the post-prototype world this lists every diagram in the signed-in
// user's account. For now, with no auth and only localStorage persistence
// of the current diagram, it shows a sign-up nudge so the surface is
// already there when accounts ship.
export function Explorer({
  position,
  minimized,
  diagrams,
  loading,
  currentDiagramId,
  onMoveTo,
  onToggleMinimized,
  onReset,
  onOpenDiagram,
  onNewDiagram,
  onRenameCurrent,
  onDeleteDiagram,
  onDuplicateDiagram,
}: ExplorerProps) {
  // Re-render every 30s so the "Updated X ago" strings stay fresh
  // while the panel is open. Cheap when the panel is minimised (this
  // function returns early below before the interval is set up).
  useRelativeTimeTick();
  // Default to collapsed so the panel stays compact when the user
  // has lots of diagrams. The header badge surfaces the count even
  // when the list isn't visible.
  const [recentOpen, setRecentOpen] = useState(false);
  if (minimized) return null;
  // Split the open diagram into its own section so the user always
  // sees which one is active. Most-recently-saved first for the rest.
  const current = currentDiagramId
    ? (diagrams.find((d) => d.id === currentDiagramId) ?? null)
    : null;
  // Cap the recents list at 5 so the accordion stays compact even
  // for power users with dozens of diagrams. Full-history access
  // lands with auth later.
  const RECENT_LIMIT = 5;
  const allOthers = [...diagrams]
    .filter((d) => d.id !== currentDiagramId)
    .sort((a, b) => b.savedAt - a.savedAt);
  const ordered = allOthers.slice(0, RECENT_LIMIT);
  return (
    <MovablePanel
      title="Explorer"
      position={position}
      defaultCorner="top-left"
      width="w-64"
      onReset={onReset}
      onMoveTo={onMoveTo}
      onMinimize={onToggleMinimized}
    >
      <div className="flex flex-col gap-2 px-3 pb-3 pt-1">
        {onNewDiagram ? (
          <button
            type="button"
            onClick={onNewDiagram}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-brand-300 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:border-brand-400 hover:bg-brand-100"
          >
            <PlusIcon />
            New Diagram
          </button>
        ) : null}

        {current ? (
          <div className="flex flex-col gap-0.5">
            <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Current Diagram
            </p>
            <ul className="flex flex-col gap-0.5">
              <li>
                <DiagramRow
                  item={current}
                  active
                  onOpen={() => onOpenDiagram(current.id)}
                  onRename={onRenameCurrent}
                  onDelete={onDeleteDiagram ? () => onDeleteDiagram(current.id) : undefined}
                  onDuplicate={
                    onDuplicateDiagram ? () => onDuplicateDiagram(current.id) : undefined
                  }
                />
              </li>
            </ul>
          </div>
        ) : null}

        {loading || ordered.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            <AccordionHeader
              label="Recent Diagrams"
              badge={loading ? null : ordered.length}
              open={recentOpen}
              onToggle={() => setRecentOpen((v) => !v)}
            />
            {recentOpen ? (
              loading ? (
                <ul className="flex flex-col gap-1" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <li
                      key={i}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1.5"
                      aria-hidden
                    >
                      <span className="h-3 w-3 shrink-0 animate-pulse rounded-sm bg-slate-200" />
                      <span
                        className="h-3 animate-pulse rounded bg-slate-200"
                        style={{ width: `${70 - i * 12}%` }}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="scrollbar-slim flex max-h-60 flex-col gap-0.5 overflow-y-auto">
                  {ordered.map((d) => (
                    <li key={d.id}>
                      <DiagramRow
                        item={d}
                        active={false}
                        onOpen={() => onOpenDiagram(d.id)}
                        onDelete={onDeleteDiagram ? () => onDeleteDiagram(d.id) : undefined}
                        onDuplicate={
                          onDuplicateDiagram ? () => onDuplicateDiagram(d.id) : undefined
                        }
                      />
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        ) : null}

        <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3 text-xs text-slate-600">
          <p className="font-medium text-slate-800">Sign in to save your diagrams</p>
          <p className="mt-1 leading-relaxed text-slate-500">
            Create an account to keep your diagrams across sessions.
          </p>
          <button
            type="button"
            disabled
            aria-disabled
            className="mt-3 inline-flex w-full cursor-not-allowed items-center justify-center rounded-md bg-brand-500/60 px-3 py-1.5 text-xs font-medium text-white shadow-sm"
            title="Sign-in is coming soon"
          >
            Sign in (coming soon)
          </button>
        </div>
      </div>
    </MovablePanel>
  );
}

// Accordion header used for the Recent Diagrams section. Click
// toggles the body open / closed; the chevron rotates to match.
// `badge` shows the section count next to the label so the user
// sees how many diagrams are stashed even when the body is
// collapsed (the default state).
function AccordionHeader({
  label,
  badge,
  open,
  onToggle,
}: {
  label: string;
  badge: number | null;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1 text-left transition hover:bg-slate-100"
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`inline-block transition-transform ${open ? 'rotate-90' : 'rotate-0'}`}
          aria-hidden
        >
          <ChevronIcon />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </span>
      {badge !== null ? (
        <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-medium text-slate-600">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-slate-400"
      aria-hidden
    >
      <path d="M3 1.5L6 4.5L3 7.5" />
    </svg>
  );
}

// Single diagram entry. Acts as both the Current Diagram row (active
// state, optional inline rename) and a Recent Diagrams row (Open /
// Delete / Duplicate menu). The ellipsis only renders when at least
// one menu action callback is wired up.
function DiagramRow({
  item,
  active,
  onOpen,
  onRename,
  onDelete,
  onDuplicate,
}: {
  item: DiagramListItem;
  active: boolean;
  onOpen: () => void;
  onRename?: (name: string) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(item.name);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const commitRename = () => {
    const next = draft.trim();
    if (next && next !== item.name && onRename) onRename(next);
    setEditing(false);
  };

  const cancelRename = () => {
    setDraft(item.name);
    setEditing(false);
  };

  const hasMenu = Boolean((onRename && active) || onDelete || onDuplicate);
  const relative = formatRelativeTime(Date.now() - item.savedAt);

  // Container carries the pill background + hover state. Both the
  // open-button and the ellipsis-button sit inside as transparent
  // children so the ellipsis visually belongs to the pill rather
  // than floating beside it.
  const pillClasses = active
    ? 'group flex items-stretch rounded-md bg-brand-100 text-brand-800'
    : 'group flex items-stretch rounded-md text-slate-700 transition hover:bg-slate-100';

  return (
    <div className={pillClasses}>
      <button
        type="button"
        onClick={editing ? undefined : onOpen}
        aria-current={active ? 'true' : undefined}
        className={`flex flex-1 items-start gap-1.5 rounded-md bg-transparent px-2 py-1.5 text-left text-xs ${active ? 'font-medium' : ''}`}
      >
        <span className="mt-0.5">
          <DiagramIcon active={active} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={commitRename}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelRename();
                }
              }}
              className="w-full rounded border border-brand-300 bg-white px-1 py-0.5 text-xs text-slate-800 outline-none focus:border-brand-500"
            />
          ) : (
            <span className="truncate">{item.name}</span>
          )}
          <span
            className={
              active
                ? 'truncate text-[10px] font-normal text-brand-700/80'
                : 'truncate text-[10px] text-slate-400'
            }
            title={new Date(item.savedAt).toLocaleString()}
          >
            Updated {relative}
          </span>
        </span>
      </button>
      {hasMenu && !editing ? (
        <button
          ref={menuButtonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          aria-label="Diagram menu"
          aria-expanded={menuOpen}
          className={`mr-1 flex w-6 shrink-0 items-center justify-center self-center rounded text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-slate-200/70 hover:text-slate-700 ${
            menuOpen ? 'opacity-100' : ''
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
            <circle cx="3" cy="7" r="1.25" fill="currentColor" />
            <circle cx="7" cy="7" r="1.25" fill="currentColor" />
            <circle cx="11" cy="7" r="1.25" fill="currentColor" />
          </svg>
        </button>
      ) : null}
      {menuOpen ? (
        <PortalMenu
          anchor={menuButtonRef.current}
          placement="below"
          onClose={() => setMenuOpen(false)}
        >
          {!active ? (
            <MenuItem
              icon={<OpenIcon />}
              label="Open"
              onClick={() => {
                onOpen();
                setMenuOpen(false);
              }}
            />
          ) : null}
          {active && onRename ? (
            <MenuItem
              icon={<PencilIcon />}
              label="Rename"
              onClick={() => {
                setEditing(true);
                setMenuOpen(false);
              }}
            />
          ) : null}
          {onDuplicate ? (
            <MenuItem
              icon={<DuplicateIcon />}
              label="Duplicate"
              onClick={() => {
                onDuplicate();
                setMenuOpen(false);
              }}
            />
          ) : null}
          {onDelete ? (
            <MenuItem
              icon={<TrashIcon />}
              label="Delete"
              danger
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
            />
          ) : null}
        </PortalMenu>
      ) : null}
    </div>
  );
}

function DiagramIcon({ active }: { active: boolean }) {
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
      className={active ? 'text-brand-600' : 'text-slate-400'}
      aria-hidden
    >
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M5 6h6M5 9h4" />
    </svg>
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

function DuplicateIcon() {
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
      <rect x="5" y="5" width="8" height="8" rx="1.25" />
      <path d="M3 11V4a1 1 0 0 1 1-1h7" />
    </svg>
  );
}

function OpenIcon() {
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
      <path d="M9.5 2.5h4v4" />
      <path d="M13 3L7.5 8.5" />
      <path d="M12.5 9.5v3a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 2v8M2 6h8" />
    </svg>
  );
}

export function ExplorerIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 5a1.5 1.5 0 0 1 1.5-1.5h3l1.5 1.5h6.5A1.5 1.5 0 0 1 17 6.5v8A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5z" />
    </svg>
  );
}

export function PaletteIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden
    >
      <rect x="3" y="3" width="6" height="6" rx="1.25" />
      <rect x="11" y="3" width="6" height="6" rx="1.25" />
      <rect x="3" y="11" width="6" height="6" rx="1.25" />
      <rect x="11" y="11" width="6" height="6" rx="1.25" />
    </svg>
  );
}
