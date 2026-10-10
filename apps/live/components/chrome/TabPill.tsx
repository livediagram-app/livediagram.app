import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import { NameEditor } from '@/components/primitives/NameEditor';
import type { Tab } from '@livediagram/document';
import type { Participant } from '@/lib/identity';
import { legibleTabAccent } from '@/lib/tab-accent';
import { TabLockIcon } from '@/components/chrome/tab-bar-icons';
import { SideBySideIcon } from '@livediagram/ui';
import { useSplitViewContext } from '@/components/split/SplitViewContext';
import { TabPresenceStack } from '@/components/chrome/TabPresenceStack';
import { TabModeIcon } from './editor-mode/TabModeIcon';
import { EllipsisMenuButton } from './EllipsisMenuButton';
import { OutOfScopeTabPill } from './OutOfScopeTabPill';
import type { useTabReorderDrag } from './useTabReorderDrag';
import type { CanvasMenuActions } from './TabBar';
import type { AccessLevel } from '@livediagram/api-schema';

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
  selfRole: AccessLevel;
  // True for a tab outside a tab-scoped share session's scope
  // (docs/specs/013-workspace/tab-scoped-share-links.md); such a tab renders as a "Not shared" pill.
  isOutOfScope?: (tabId: string) => boolean;
  // Threaded to the presence stack: the follow ring (docs/specs/012-collaboration/follow-me-viewport.md) and the
  // Collaborators modal an avatar click opens (docs/specs/012-collaboration/collaborator-enhancements.md).
  followingId?: string | null;
  onOpenCollaborators?: (participantId: string | null) => void;
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
  // The tab showing in the other pane (docs/specs/007-editor/split-view.md) says so on its pill.
  const split = useSplitViewContext();
  const beside =
    !!split?.pair &&
    tab.id !== split.activeId &&
    (split.pair.leftId === tab.id || split.pair.rightId === tab.id);
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
    followingId,
    onOpenCollaborators,
    canvasActions,
    tabMenuProps,
    isOutOfScope,
  } = ctx;
  if (isOutOfScope?.(tab.id)) {
    return (
      <OutOfScopeTabPill
        participants={participantsByTab.get(tab.id) ?? []}
        selfId={selfId}
        selfRole={selfRole}
      />
    );
  }
  const isActive = tab.id === activeId;
  const isEditing = editingId === tab.id;
  const caret = reorderDrag.caretFor(tab.id);
  const showCaretBefore = caret === 'before';
  const showCaretAfter = caret === 'after';
  return (
    <div
      key={tab.id}
      // Tour anchor (docs/specs/007-editor/editor-tour.md): the Tabs step highlights the active pill
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
      // with the theme accent kept on the opening-mode icon inside the label.
      // color-mix keeps the ring legible for non-hex accents too.
      style={
        isActive && !isEditing
          ? {
              color: legibleTabAccent(tab, isDark),
              // Dark: the dark palette's raised surface, so a themed tab's tint reaches it too.
              backgroundColor: isDark ? 'var(--color-slate-800)' : '#ffffff',
              boxShadow: `0 0 0 1px color-mix(in srgb, ${legibleTabAccent(tab, isDark)} 45%, transparent), 0 1px 3px rgb(0 0 0 / ${isDark ? '0.45' : '0.12'})`,
            }
          : undefined
      }
      className={`relative flex shrink-0 items-center gap-1 rounded-lg transition ${
        // While renaming, the NameEditor carries the ONLY box (its own ring +
        // background): the pill sheds its ring / fill / padding so the field
        // doesn't render as a box inside a box.
        isEditing
          ? 'px-0'
          : isActive
            ? // The trailing ellipsis button carries its own padding around the glyph, so the pill's
              // own trailing padding is trimmed to balance the icon's side (optical-alignment.md).
              readOnly
              ? 'px-2.5'
              : 'pl-2.5 pr-1'
            : 'bg-slate-200/50 px-2.5 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }${beside && !isActive ? ' outline-1 -outline-offset-1 outline-brand-400/70 outline-dashed' : ''}`}
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
          className="flex h-7 items-center gap-1.5 rounded-lg text-sm font-medium"
        >
          {/* The mode you work in on this tab (docs/specs/007-editor/editor-modes.md), tinted with
              the tab theme's accent; the pill text itself stays neutral so it reads on the bar for
              ANY theme. */}
          <TabModeIcon tab={tab} style={{ color: legibleTabAccent(tab, isDark) }} />
          {tab.locked ? <TabLockIcon /> : null}
          {/* Trimmed to its cap band so the name centres on its letters; the button's height is
              pinned because the trimmed name no longer props it open. */}
          <span className="text-optical-centre">{tab.name}</span>
          {beside ? (
            <span className="flex items-center text-brand-500 dark:text-brand-300">
              <SideBySideIcon size={12} />
              <span className="sr-only">, open side by side</span>
            </span>
          ) : null}
        </button>
      )}
      <TabPresenceStack
        participants={participantsByTab.get(tab.id) ?? []}
        selfId={selfId}
        selfRole={selfRole}
        followingId={followingId}
        onOpenCollaborators={onOpenCollaborators}
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
