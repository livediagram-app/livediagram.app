import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Tab } from '@livediagram/diagram';

type TabBarProps = {
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
  onReorder: (sourceId: string, targetId: string) => void;
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
  onReorder,
}: TabBarProps) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-t border-slate-200 bg-white px-2">
      <div className="scrollbar-slim flex flex-1 items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          const isEditing = editingId === tab.id;
          const isDragOver = overId === tab.id && dragId && dragId !== tab.id;
          return (
            <div
              key={tab.id}
              draggable={!isEditing}
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
              className={`relative flex shrink-0 items-center gap-0.5 rounded-md transition ${
                isActive
                  ? 'bg-brand-100 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
                  onDoubleClick={() => isActive && setEditingId(tab.id)}
                  className="rounded-md px-3 py-1.5 text-sm font-medium"
                >
                  {tab.name}
                </button>
              )}
              {isActive && !isEditing ? (
                <EllipsisMenuButton
                  open={menuFor === tab.id}
                  onToggle={() => setMenuFor(menuFor === tab.id ? null : tab.id)}
                  onClose={() => setMenuFor(null)}
                  canDelete={tabs.length > 1}
                  canClearContent={activeTabHasContent}
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
                  onDelete={() => {
                    onDelete(tab.id);
                    setMenuFor(null);
                  }}
                />
              ) : null}
            </div>
          );
        })}
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add tab"
          className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-lg leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          +
        </button>
      </div>
    </div>
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
  otherDiagrams,
  onRename,
  onDuplicate,
  onClearContent,
  onCopyTo,
  onDelete,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  canDelete: boolean;
  canClearContent: boolean;
  otherDiagrams: { id: string; name: string }[];
  onRename: () => void;
  onDuplicate: () => void;
  onClearContent: () => void;
  onCopyTo: (targetDiagramId: string) => void;
  onDelete: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="pr-1">
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

  // After the menu mounts, nudge it back on-screen if it overflows any edge
  // (e.g. Tab 1 is near the left and the menu opens left of its anchor).
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || !pos) return;
    const rect = node.getBoundingClientRect();
    const margin = 8;
    let dx = 0;
    let dy = 0;
    if (rect.left < margin) dx = margin - rect.left;
    else if (rect.right > window.innerWidth - margin) dx = window.innerWidth - margin - rect.right;
    if (rect.top < margin) dy = margin - rect.top;
    else if (rect.bottom > window.innerHeight - margin)
      dy = window.innerHeight - margin - rect.bottom;
    if (dx !== adjust.x || dy !== adjust.y) setAdjust({ x: dx, y: dy });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

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
