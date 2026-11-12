'use client';

// The start panel (docs/specs/007-editor/start-panel.md): an empty tab's one wide panel, a rail of categories
// beside a grid of large cards (StartCard) and a search across them. The panel itself is the shared one
// (@liveworkspace/workbench/components/start/StartPanel); this binds it to this editor's card grid, tint and help
// link for Start Planning, which cannot close (its phone sheet settles back when dragged), with Import at the rail's foot.
import { createStartPanel } from '@liveworkspace/workbench/components/start/StartPanel';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { StartCardGrid, startTint } from './StartCard';

export type { StartPanelCard } from './StartCard';
// An entry at the rail's foot, below Connect File, that opens a dialog (Start Planning's Import).
export type { StartPanelFootAction } from '@liveworkspace/workbench/components/start/StartPanel';

export const StartPanel = createStartPanel({
  app: 'liveplanner',
  HelpLink: HelpArticleLink,
  CardGrid: StartCardGrid,
  tint: startTint,
  sheet: true,
  // Hidden while what it holds draws nothing (the switch not offered: signed out, or not ready yet), so no empty
  // strip and hairline sit under the choices.
  hideEmptyFooter: true,
});
