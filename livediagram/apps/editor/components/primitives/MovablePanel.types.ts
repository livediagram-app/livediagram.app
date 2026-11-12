// livediagram's movable panel props: the shared ones (@liveworkspace/workbench/components/primitives/MovablePanel.types),
// over this editor's help-article keys. This editor has no tab-filling board for a panel to stand beside, so
// it takes no `layoutChrome`.
import type { MovablePanelProps as SharedMovablePanelProps } from '@liveworkspace/workbench/components/primitives/MovablePanel.types';
import type { HelpArticleKey } from '@/lib/help-articles';

export type {
  MovablePanelDockProps,
  MovablePanelPlacementProps,
  MovablePanelPopoverProps,
} from '@liveworkspace/workbench/components/primitives/MovablePanel.types';

export type MovablePanelProps = Omit<SharedMovablePanelProps<HelpArticleKey>, 'layoutChrome'>;
