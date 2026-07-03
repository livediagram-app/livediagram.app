import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NameEditor } from '@/components/primitives/NameEditor';
import type { Tab } from '@livediagram/diagram';
import type { Participant } from '@/lib/identity';
import { TabPresenceStack } from '@/components/chrome/TabPresenceStack';

// One folder group in the tab bar (spec/30). The folder renders as a
// compact chip (glyph + name + count) plus, when the ACTIVE tab lives in
// the folder, that one member pill inline beside it — the rest of the
// members stay off the bar so a big folder costs almost no horizontal
// space. Clicking the chip fans the members UPWARD: a transient popover
// above the bar listing every other member as the same pill loose tabs
// use (selection, presence, drag-reorder, context menu), rendered by the
// parent via `renderTab` so behaviour can't drift. Picking one switches
// to it (it becomes the inline pill) and closes the fan.

type TabFolderChipProps = {
  name: string;
  tabs: Tab[];
  activeId: string;
  readOnly: boolean;
  // Render one member pill — the parent's per-tab renderer, reused so
  // folder members behave exactly like loose tabs.
  renderTab: (tab: Tab) => ReactNode;
  // Drop a dragged tab next to this folder. Reorder-only (membership is
  // menu-only, spec/30); the parent normalizes afterwards. The optional
  // `placeBefore` is unused here (dropping on the chip always joins at the
  // head), but keeps the signature aligned with the parent's onReorder.
  onReorder: (sourceId: string, targetId: string, placeBefore?: boolean) => void;
  onRename: (oldName: string, newName: string) => void;
  // Live presence per tab + the local participant, so the folder chip can
  // surface the participants viewing its hidden member tabs (the inline
  // active pill shows its own stack).
  participantsByTab: Map<string, Participant[]>;
  selfId: string;
  selfRole: 'edit' | 'view';
};

export function TabFolderChip({
  name,
  tabs,
  activeId,
  readOnly,
  renderTab,
  onReorder,
  onRename,
  participantsByTab,
  selfId,
  selfRole,
}: TabFolderChipProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const chipRef = useRef<HTMLDivElement>(null);
  // The fan's fixed-position anchor, captured when it opens (the tab strip
  // scrolls horizontally, so the popover portals out of its clip).
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null);

  const activeMember = tabs.find((t) => t.id === activeId) ?? null;
  // The fan lists the members NOT already visible inline.
  const fanTabs = tabs.filter((t) => t.id !== activeId);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = chipRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ left: rect.left, bottom: window.innerHeight - rect.top + 8 });
    setOpen(true);
  };

  // The fan is transient: any outside press or Escape closes it, and
  // switching tabs (picking a member) closes it too.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[data-tab-folder-fan]') || chipRef.current?.contains(t as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  useEffect(() => {
    setOpen(false);
  }, [activeId]);

  // Participants viewing the folder's HIDDEN member tabs, deduped by id —
  // the inline active pill shows its own stack, so it's excluded here.
  const folderParticipants: Participant[] = [];
  {
    const seen = new Set<string>();
    for (const t of tabs) {
      if (t.id === activeId) continue;
      for (const p of participantsByTab.get(t.id) ?? []) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        folderParticipants.push(p);
      }
    }
  }

  return (
    <div
      ref={chipRef}
      // A folder reads as a CONTAINER, clearly distinct from the tab pills
      // inside it: dashed boundary (the app's "grouping" cue) + a tinted
      // inset surface the inline active pill sits on.
      className={`flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-100/70 px-1 py-0.5 dark:border-slate-600 dark:bg-slate-800/40 ${
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
              // this folder's run as a member. Works whether or not the fan
              // is open (the chip is always a drop target).
              const firstMember = tabs[0];
              if (src && firstMember && src !== firstMember.id) onReorder(src, firstMember.id);
            }
      }
    >
      {editing && !readOnly ? (
        <NameEditor
          initial={name}
          onCommit={(next) => {
            const trimmed = next.trim();
            if (trimmed && trimmed !== name) onRename(name, trimmed);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          className="w-28 rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none ring-1 ring-brand-300 dark:bg-slate-800 dark:text-slate-100 dark:ring-brand-400"
        />
      ) : (
        <button
          type="button"
          onClick={toggle}
          onDoubleClick={readOnly ? undefined : () => setEditing(true)}
          aria-expanded={open}
          aria-label={`${name} — ${tabs.length} ${tabs.length === 1 ? 'tab' : 'tabs'}`}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-slate-100"
        >
          <FolderGlyph open={open} />
          <span>{name}</span>
          <span className="rounded-full bg-slate-200 px-1.5 py-px text-[10px] font-semibold leading-none text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            {tabs.length}
          </span>
        </button>
      )}
      {/* Only the folder's OPEN tab sits in the bar; everyone else lives in
          the upward fan, so a big folder stays one chip wide. */}
      {activeMember ? renderTab(activeMember) : null}
      {folderParticipants.length > 0 ? (
        // Who's inside the hidden members, so a viewer on one isn't
        // invisible. The stack's own ml-2 spaces it off the count badge.
        <TabPresenceStack participants={folderParticipants} selfId={selfId} selfRole={selfRole} />
      ) : null}
      {open && anchor && fanTabs.length > 0
        ? createPortal(
            <div
              data-tab-folder-fan
              className="fixed z-[var(--z-modal)] flex animate-fade-in flex-col items-start gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
              style={{ left: anchor.left, bottom: anchor.bottom }}
            >
              {fanTabs.map((t) => (
                <div key={t.id} className="flex w-full items-center">
                  {renderTab(t)}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

// The folder glyph doubles as the fan's state: closed when the members
// are tucked away, open while the fan is showing. Clearer than a separate
// chevron.
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
