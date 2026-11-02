import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import { NameEditor } from '@liveworkspace/workbench/components/primitives/NameEditor';
import type { Tab } from '@livehuddle/document';
import type { Participant } from '@/lib/identity';
import { legibleTabAccent } from '@/lib/tab-accent';
import { TabLockIcon } from '@/components/chrome/tab-bar-icons';
import { SideBySideIcon } from '@livehuddle/ui';
import { useSplitViewContext } from '@/components/split/SplitViewContext';
import { TabPresenceStack } from '@/components/chrome/TabPresenceStack';
import { EllipsisMenuButton } from './EllipsisMenuButton';
import { OutOfScopeTabPill } from './OutOfScopeTabPill';
import type { useTabReorderDrag } from '@liveworkspace/workbench/components/chrome/useTabReorderDrag';
import { TAB_RENAME_FIELD_CLASS } from '@liveworkspace/workbench/components/chrome/tab-shape';
import { TabFrame } from '@liveworkspace/workbench/components/chrome/TabFrame';
import type { CanvasMenuActions } from './TabBar';
import type { AccessLevel } from '@livehuddle/api-schema';

// One tab in the bar: this app's pieces (its rename field, presence avatars, menu and split view mark) in the
// shared TabFrame, which draws the tab alike in every editor ("How a tab looks" in the editor spec). Loose tabs and
// folder members (rendered by the shared TabStrip through the bar's renderTab) are this one component, so
// selection, presence, drag-reorder and the menu behave the same in or out of a folder. The per-render bundle
// (TabPillCtx, built once in TabBar) carries the shared state and handlers.
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
  return (
    <TabFrame
      key={tab.id}
      id={tab.id}
      name={tab.name}
      active={isActive}
      readOnly={readOnly}
      // The open tab's name takes the tab theme's accent, made legible on its card; the others keep neutral ink.
      accent={isActive ? legibleTabAccent(tab, isDark) : undefined}
      lockIcon={tab.locked ? <TabLockIcon /> : null}
      // Tour anchor (docs/specs/007-editor/editor-tour.md): the Tabs step highlights the open tab together with the
      // add button.
      tourId={isActive ? 'active-tab' : undefined}
      caret={reorderDrag.caretFor(tab.id)}
      dragging={reorderDrag.isDragging(tab.id)}
      dragHandlers={reorderDrag.handlersFor(tab.id)}
      className={
        beside && !isActive
          ? 'outline-1 -outline-offset-1 outline-brand-400/70 outline-dashed'
          : undefined
      }
      onSelect={() => onSelect(tab.id)}
      onRequestRename={() => setEditingId(tab.id)}
      onContextMenu={
        readOnly
          ? undefined
          : (e) => {
              // Right-click anywhere on the tab (name, gap, avatars, menu button) opens the tab menu, switching to
              // the clicked tab first so the menu's open-tab actions target what was pointed at.
              e.preventDefault();
              if (!isActive) onSelect(tab.id);
              setMenuFor(tab.id);
            }
      }
      renameField={
        isEditing ? (
          <NameEditor
            label="Tab name"
            initial={tab.name}
            onCommit={(name) => {
              onRename(tab.id, name.trim() || tab.name);
              setEditingId(null);
            }}
            onCancel={() => setEditingId(null)}
            className={TAB_RENAME_FIELD_CLASS}
          />
        ) : undefined
      }
      afterName={
        beside ? (
          <span className="flex items-center text-brand-700 dark:text-brand-300">
            <SideBySideIcon size={12} />
            <span className="sr-only">, open side by side</span>
          </span>
        ) : null
      }
      hasPresence={(participantsByTab.get(tab.id)?.length ?? 0) > 0}
      presence={
        <TabPresenceStack
          participants={participantsByTab.get(tab.id) ?? []}
          selfId={selfId}
          selfRole={selfRole}
          followingId={followingId}
          followerCount={followerCount}
          onOpenCollaborators={onOpenCollaborators}
        />
      }
      menu={
        isActive && !isEditing && !readOnly ? (
          <EllipsisMenuButton
            open={menuFor === tab.id}
            onToggle={() => setMenuFor(menuFor === tab.id ? null : tab.id)}
            onClose={() => setMenuFor(null)}
            canvas={canvasActions}
            {...tabMenuProps(tab, () => setMenuFor(null))}
          />
        ) : null
      }
    />
  );
}
