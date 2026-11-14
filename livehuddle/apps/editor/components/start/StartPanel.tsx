'use client';

// The start panel (docs/specs/007-editor/start-diagramming.md): an empty tab's one wide panel, a rail of categories
// beside a grid of large cards (StartCard) and a search across them. The panel itself is the shared one
// (@liveworkspace/workbench/components/start/StartPanel); this binds it to this editor's card grid, tint and help
// link for the start.
import { createStartPanel } from '@liveworkspace/workbench/components/start/StartPanel';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { chosenLabel } from './start-palette';
import { StartCardGrid, startTint } from '@liveworkspace/workbench/components/start/StartCard';

export type { StartPanelCard } from '@liveworkspace/workbench/components/start/StartCard';

export const StartPanel = createStartPanel({
  app: 'livehuddle',
  HelpLink: HelpArticleLink,
  CardGrid: StartCardGrid,
  tint: startTint,
  // The chosen rail row's label: the accent, darkened as far as it needs to read at AA on its tint.
  chosenInk: chosenLabel,
  sheet: true,
});
