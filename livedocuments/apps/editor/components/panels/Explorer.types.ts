import type { MovablePanelPopoverProps } from '@/components/primitives/MovablePanel.types';

// The editor's Explorer panel: the shared Explorer's panel (@liveworkspace/explorer `ExplorerPanel`) in the
// editor's movable panel. It loads its own lists from the index, so the editor hands it only where its button is and
// which document is open.
export type ExplorerProps = {
  // The document open in the editor, shown on top.
  currentDocumentId: string | null;
  // The link the open document was reached through, so the panel reads it as that visitor.
  currentShareCode?: string | null;
  // The open document renamed from the panel (its card, or its row's menu): the editor's title follows.
  onRenameCurrent?: (name: string) => void;
  // The editor's own New (the in-editor flow); without it New goes to /new.
  onNewDocument?: () => void;
  // The header ⋯ menu's verbs beyond new / open. Each optional: an absent handler drops its row.
  menuActions?: ExplorerMenuActions;
  // The open document's active tab and the canvas's Mark Done, so the Inbox's pane can mark an action there done in
  // place (lib/explorer-inbox-host). Null where the document is read-only.
  inboxOpenAction?: {
    tabId: string;
    markDone: (elementId: string, actionId: string) => void;
  } | null;
  // The popover under the canvas's menu button, its only form (docs/specs/007-editor/toolbar-layout.md): never
  // docked, placed or open on its own, and dismissed by a press outside.
} & Omit<MovablePanelPopoverProps, 'asPopover' | 'dismissOnOutside'>;

export type ExplorerMenuActions = {
  onShare?: () => void;
  onExport?: () => void;
  onSearch?: () => void;
  onOpenSettings?: () => void;
};
