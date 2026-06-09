import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Tab } from '@livediagram/diagram';
import type { Participant } from '@/lib/identity';
import { readLocalStorageSafe, writeLocalStorageSafe } from '@/lib/local-storage-safe';
import { TabPresenceStack } from './TabPresenceStack';
import { Tooltip } from './Tooltip';

// One folder group in the tab bar (spec/30). Collapsed it shows just
// the folder name + member count; expanded it shows the chip plus the
// member tab pills, which are rendered by the parent via `renderTab`
// so they're byte-for-byte the same pills loose tabs use (selection,
// presence, drag-reorder, ellipsis menu). The folder is a contiguous
// run of same-folder tabs — membership and ordering are owned upstream;
// this component only handles the collapse affordance + rename.

// Collapse state is UI-only and per-browser: never persisted to D1,
// never broadcast. Keyed by diagram + folder so two diagrams (or two
// folders) don't share a toggle.
function collapseKey(diagramId: string, folder: string): string {
  return `tabfolder:${diagramId}:${folder}`;
}

type TabFolderChipProps = {
  name: string;
  tabs: Tab[];
  activeId: string;
  diagramId: string;
  readOnly: boolean;
  // Render one member pill — the parent's per-tab renderer, reused so
  // folder members behave exactly like loose tabs.
  renderTab: (tab: Tab) => ReactNode;
  // Drop a dragged tab next to this folder. Reorder-only (membership is
  // menu-only, spec/30); the parent normalizes afterwards.
  onReorder: (sourceId: string, targetId: string) => void;
  onRename: (oldName: string, newName: string) => void;
  // Live presence per tab + the local participant, so a COLLAPSED folder
  // can surface the participants viewing its (hidden) member tabs — when
  // expanded, each member pill shows its own stack instead.
  participantsByTab: Map<string, Participant[]>;
  selfId: string;
  selfRole: 'edit' | 'view';
};

export function TabFolderChip({
  name,
  tabs,
  activeId,
  diagramId,
  readOnly,
  renderTab,
  onReorder,
  onRename,
  participantsByTab,
  selfId,
  selfRole,
}: TabFolderChipProps) {
  // Default collapsed: opening a diagram shows every folder folded so the
  // tab bar stays tidy. Starting true (rather than hydrating to it) also
  // avoids an expand→collapse flash on first paint. The active tab's
  // folder still force-expands via `containsActive` below.
  const [collapsed, setCollapsed] = useState(true);
  const [editing, setEditing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Hydrate the persisted collapse state after mount (localStorage is
  // client-only; reading during render would desync SSR/CSR markup).
  // Only a folder the user EXPLICITLY expanded before (stored '0')
  // reopens; anything else (never toggled, or explicitly collapsed)
  // stays folded.
  useEffect(() => {
    setCollapsed(readLocalStorageSafe(collapseKey(diagramId, name)) !== '0');
  }, [diagramId, name]);

  const containsActive = tabs.some((t) => t.id === activeId);
  // Force-expand while the active tab lives in this folder so the user
  // can always see where they are (spec/30 edge case).
  const showMembers = !collapsed || containsActive;

  // Auto-collapse when the user navigates OUT of this folder: once the
  // active tab leaves (and didn't move to another tab in here), fold the
  // folder back up so the tab bar stays tidy — a folder only stays open
  // while you're working inside it. Only acts on an expanded folder; a
  // force-expanded one (collapsed already true) folds on its own as
  // `containsActive` flips. Re-entering force-expands it again.
  const wasActiveInside = useRef(containsActive);
  useEffect(() => {
    if (wasActiveInside.current && !containsActive && !collapsed) {
      setCollapsed(true);
      writeLocalStorageSafe(collapseKey(diagramId, name), '1');
    }
    wasActiveInside.current = containsActive;
  }, [containsActive, collapsed, diagramId, name]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    writeLocalStorageSafe(collapseKey(diagramId, name), next ? '1' : '0');
  };

  // Participants viewing the folder's member tabs, deduped by id. Only
  // surfaced while collapsed: the member pills are hidden then, so their
  // own presence stacks aren't visible and a viewer inside the folder
  // would otherwise be invisible. Expanded, each pill shows its own.
  const folderParticipants: Participant[] = [];
  if (!showMembers) {
    const seen = new Set<string>();
    for (const t of tabs) {
      for (const p of participantsByTab.get(t.id) ?? []) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        folderParticipants.push(p);
      }
    }
  }

  return (
    <div
      className={`flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-1 py-0.5 dark:border-slate-700 ${
        dragOver ? 'ring-2 ring-brand-400 ring-offset-1' : ''
      }`}
      onDragOver={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (!dragOver) setDragOver(true);
            }
      }
      onDragLeave={() => dragOver && setDragOver(false)}
      onDrop={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault();
              setDragOver(false);
              const src = e.dataTransfer.getData('text/plain');
              // Drop onto the folder chip JOINS the folder (spec/30):
              // onReorder adopts the target's folder, and the target is the
              // run's first member, so the dropped tab lands at the head of
              // this folder's run as a member. Works on a collapsed folder
              // too (the chip is always a drop target).
              const firstMember = tabs[0];
              if (src && firstMember && src !== firstMember.id) onReorder(src, firstMember.id);
            }
      }
    >
      {editing && !readOnly ? (
        <FolderNameEditor
          initial={name}
          onCommit={(next) => {
            const trimmed = next.trim();
            if (trimmed && trimmed !== name) onRename(name, trimmed);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <Tooltip
          title={showMembers ? 'Collapse folder' : 'Expand folder'}
          description={`"${name}" - ${tabs.length} ${tabs.length === 1 ? 'tab' : 'tabs'}${
            readOnly ? '' : '. Double-click to rename.'
          }`}
        >
          <button
            type="button"
            onClick={toggle}
            onDoubleClick={readOnly ? undefined : () => setEditing(true)}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FolderGlyph open={showMembers} />
            <span>{name}</span>
            <span className="rounded-full bg-slate-200 px-1.5 py-px text-[10px] font-semibold leading-none text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              {tabs.length}
            </span>
          </button>
        </Tooltip>
      )}
      {showMembers ? (
        <div className="flex items-center gap-1">{tabs.map(renderTab)}</div>
      ) : folderParticipants.length > 0 ? (
        // Collapsed: show who's inside so a viewer on a hidden tab isn't
        // invisible. The stack's own ml-2 spaces it off the count badge.
        <TabPresenceStack participants={folderParticipants} selfId={selfId} selfRole={selfRole} />
      ) : null}
    </div>
  );
}

function FolderNameEditor({
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
      className="w-28 rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none ring-1 ring-brand-300 dark:bg-slate-800 dark:text-slate-100 dark:ring-brand-400"
    />
  );
}

// The folder itself carries the expand/collapse state: a closed folder
// when collapsed, an open folder when its members are showing. Clearer
// than a separate chevron (which, while a folder is force-expanded for the
// active tab, was stuck pointing "open" with no way to act on it).
function FolderGlyph({ open }: { open: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {open ? (
        <path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
      ) : (
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      )}
    </svg>
  );
}
