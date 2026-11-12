// livedocuments's movable panel props: the shared ones (@liveworkspace/workbench/components/primitives/MovablePanel.types),
// over this editor's help-article keys, `layoutChrome` included (docs/specs/007-editor/panel-docking.md).
import type { MovablePanelProps as SharedMovablePanelProps } from '@liveworkspace/workbench/components/primitives/MovablePanel.types';
import type { HelpArticleKey } from '@/lib/help-articles';

export type {
  MovablePanelDockProps,
  MovablePanelPlacementProps,
  MovablePanelPopoverProps,
} from '@liveworkspace/workbench/components/primitives/MovablePanel.types';

export type MovablePanelProps = SharedMovablePanelProps<HelpArticleKey>;
