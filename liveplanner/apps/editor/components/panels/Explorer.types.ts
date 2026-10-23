import type { MovablePanelDockProps } from '@/components/primitives/MovablePanel';
import type { MovablePanelPopoverProps } from '@/components/primitives/MovablePanel.types';

// The editor's Explorer panel: the shared Explorer's panel (@liveworkspace/explorer `ExplorerPanel`) in the
// editor's movable panel. It loads its own lists from the index, so the editor hands it only where it sits and
// which plan is open.
export type ExplorerProps = {
  position: { x: number; y: number } | null;
  // The plan open in the editor, shown on top; null on the status screens.
  currentProjectId: string | null;
  // The link the open plan was reached through, so the panel reads it as that visitor.
  currentShareCode?: string | null;
  // The open plan renamed from the panel (its card, or its row's menu): the editor's title follows.
  onRenameCurrent?: (name: string) => void;
  onMoveTo: (x: number, y: number) => void;
  onReset?: () => void;
  // The editor's own New (the in-editor flow); without it New goes to /new.
  onNewProject?: () => void;
  // The header ⋯ menu's verbs beyond new / open. Each optional: an absent handler drops its row.
  menuActions?: ExplorerMenuActions;
  // Corner-docking bundle (docs/specs/007-editor/panel-docking.md), forwarded to the inner MovablePanel.
  dock?: MovablePanelDockProps;
} & MovablePanelPopoverProps;

export type ExplorerMenuActions = {
  onShare?: () => void;
  onExport?: () => void;
  onSearch?: () => void;
  onOpenSettings?: () => void;
};
