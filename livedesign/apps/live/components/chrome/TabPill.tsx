import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import { NameEditor } from '@/components/primitives/NameEditor';
import type { Tab } from '@livedesign/design';
import type { Participant } from '@/lib/identity';
import { legibleTabAccent } from '@/lib/tab-accent';
import { TabLockIcon } from '@/components/chrome/tab-bar-icons';
import { SideBySideIcon } from '@livedesign/ui';
import { useSplitViewContext } from '@/components/split/SplitViewContext';
import { TabPresenceStack } from '@/components/chrome/TabPresenceStack';
import { EllipsisMenuButton } from './EllipsisMenuButton';
import { OutOfScopeTabPill } from './OutOfScopeTabPill';
import type { useTabReorderDrag } from '@liveworkspace/workbench/components/chrome/useTabReorderDrag';
import {
  TAB_ACCENT_CLASS,
  tabShapeClass,
} from '@liveworkspace/workbench/components/chrome/tab-shape';
import type { CanvasMenuActions } from './TabBar';
import type { AccessLevel } from '@livedesign/api-schema';

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
  followerCount?: number;
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
    followerCount,
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
  const accent = legibleTabAccent(tab, isDark);
  return (
    <div
      key={tab.id}
      // Tour anchor: the active pill.
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
      // The tab's shape (tab-shape, docs/specs/007-editor/live-app.md "How a tab looks"): the active tab rises from
      // the screen's bottom edge, the others sit flat on the bar; no type icon before the name. The active tab's name takes the tab theme's
      // accent, made legible on its surface; the others keep neutral ink, readable whatever the tab's theme.
      data-tab=""
      data-active={isActive ? '' : undefined}
      style={isActive && !isEditing ? { color: accent } : undefined}
      className={`${tabShapeClass({ active: isActive, editing: isEditing, readOnly })}${
        beside && !isActive
          ? ' outline-1 -outline-offset-1 outline-brand-400/70 outline-dashed'
          : ''
      }`}
    >
      {isActive && !isEditing ? (
        <span aria-hidden className={TAB_ACCENT_CLASS} style={{ backgroundColor: accent }} />
      ) : null}
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
          className="relative flex h-7 cursor-pointer items-center gap-1.5 rounded-md text-sm font-medium outline-none touch-target-y focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          {tab.locked ? <TabLockIcon /> : null}
          {/* Trimmed to its cap band so the name centres on its letters; the button's height is
              pinned because the trimmed name no longer props it open. */}
          <span className="text-optical-centre">{tab.name}</span>
          {beside ? (
            <span className="flex items-center text-brand-700 dark:text-brand-300">
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
        followerCount={followerCount}
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
