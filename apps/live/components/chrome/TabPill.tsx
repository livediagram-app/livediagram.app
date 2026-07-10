import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import { NameEditor } from '@/components/primitives/NameEditor';
import type { Tab } from '@livediagram/diagram';
import type { Participant } from '@/lib/identity';
import { legibleTabAccent } from '@/lib/tab-accent';
import { TabLockIcon } from '@/components/chrome/tab-bar-icons';
import { TabPresenceStack } from '@/components/chrome/TabPresenceStack';
import { EllipsisMenuButton } from './EllipsisMenuButton';
import type { useTabReorderDrag } from './useTabReorderDrag';
import type { CanvasMenuActions } from './TabBar';

// One tab pill, lifted out of TabBar's renderTabPill closure. Loose
// tabs and folder members (rendered inside TabFolderChip via the
// host's renderTab callback) share this exact component — selection,
// presence, drag-reorder, and the ellipsis menu all behave identically
// whether or not the tab lives in a folder. The per-render bundle
// (TabPillCtx, built once in TabBar) carries the shared state +
// handlers so the render callback stays a one-liner.
export type TabPillCtx = {
  activeId: string;
  editingId: string | null;
  setEditingId: Dispatch<SetStateAction<string | null>>;
  menuFor: string | null;
  setMenuFor: Dispatch<SetStateAction<string | null>>;
  readOnly: boolean;
  isDark: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  reorderDrag: ReturnType<typeof useTabReorderDrag>;
  participantsByTab: Map<string, Participant[]>;
  selfId: string;
  selfRole: 'edit' | 'view';
  canvasActions?: CanvasMenuActions;
  // The shared tab-menu callback bundle (see TabBar.tabMenuProps): the
  // exact props EllipsisMenuButton's menu needs, minus its own
  // open/close plumbing.
  tabMenuProps: (
    tab: Tab,
    close: () => void,
  ) => Omit<ComponentProps<typeof EllipsisMenuButton>, 'open' | 'onToggle' | 'onClose' | 'canvas'>;
};

export function TabPill({ tab, ctx }: { tab: Tab; ctx: TabPillCtx }) {
  const {
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
  } = ctx;
  const isActive = tab.id === activeId;
  const isEditing = editingId === tab.id;
  const caret = reorderDrag.caretFor(tab.id);
  const showCaretBefore = caret === 'before';
  const showCaretAfter = caret === 'after';
  return (
    <div
      key={tab.id}
      // Tour anchor (spec/79): the Tabs step highlights the active pill
      // together with the add button.
      data-tour-id={isActive ? 'active-tab' : undefined}
      draggable={!isEditing && !readOnly}
      {...reorderDrag.handlersFor(tab.id)}
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
      // Active tab: a raised card (bar-contrasting surface + accent ring +
      // accent text) so it can't blend into the bar; inactive tabs use
      // neutral slate text — readable on the bar whatever the tab's theme —
      // with the theme accent kept as the identity dot inside the label.
      // color-mix keeps the ring legible for non-hex accents too.
      style={
        isActive
          ? {
              color: legibleTabAccent(tab, isDark),
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              boxShadow: `0 0 0 1px color-mix(in srgb, ${legibleTabAccent(tab, isDark)} 45%, transparent), 0 1px 3px rgb(0 0 0 / ${isDark ? '0.45' : '0.12'})`,
            }
          : undefined
      }
      className={`relative flex shrink-0 items-center gap-1 rounded-lg px-2.5 transition ${
        isActive
          ? ''
          : 'bg-slate-200/50 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      {/* Insertion caret: a vertical bar in the gap on the side the tab
          will land. pointer-events-none so it never intercepts the drag. */}
      {showCaretBefore ? (
        <span className="pointer-events-none absolute inset-y-1 -left-1 z-10 w-1 rounded-full bg-brand-500" />
      ) : null}
      {showCaretAfter ? (
        <span className="pointer-events-none absolute inset-y-1 -right-1 z-10 w-1 rounded-full bg-brand-500" />
      ) : null}
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
          aria-current={isActive ? 'page' : undefined}
          className="flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium"
        >
          {/* The tab theme's accent as a small identity dot — the pill text
              itself stays neutral so it reads on the bar for ANY theme. */}
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: legibleTabAccent(tab, isDark) }}
          />
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
}
