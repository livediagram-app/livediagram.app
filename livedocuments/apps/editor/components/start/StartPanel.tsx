'use client';

// The start panel (docs/specs/007-editor/start-diagramming.md): an empty tab's one wide panel, a rail of categories
// beside a grid of large cards (StartCard) and a search across them. The panel itself is the shared one
// (@liveworkspace/workbench/components/start/StartPanel); this binds it to this editor's card grid, tint and help
// link for the start, which never closes: an empty tab holds no page until something is chosen ("A choice first"), so it is no sheet to drag, with no × or grab handle.
import { createStartPanel } from '@liveworkspace/workbench/components/start/StartPanel';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { StartCardGrid, startTint } from './StartCard';

export type { StartPanelCard } from './StartCard';

export const StartPanel = createStartPanel({
  app: 'livedocuments',
  HelpLink: HelpArticleLink,
  CardGrid: StartCardGrid,
  tint: startTint,
  sheet: false,
});
