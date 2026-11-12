'use client';

// The start panel (docs/specs/007-editor/start-diagramming.md): an empty tab's one wide panel, a rail of categories
// beside a grid of large cards (StartCard) and a search across them. The panel itself is the shared one
// (@liveworkspace/workbench/components/start/StartPanel); this binds it to this editor's card grid, tint and help
// link for all three starts (Diagram, Draw and Workshop), each with the other modes' matches under its own.
import { createStartPanel } from '@liveworkspace/workbench/components/start/StartPanel';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { chosenLabel } from './start-palette';
import { StartCardGrid, startTint } from './StartCard';
import { StartOtherModes } from './StartOtherModes';

export type { StartPanelCard } from './StartCard';

export const StartPanel = createStartPanel({
  app: 'livediagram',
  HelpLink: HelpArticleLink,
  CardGrid: StartCardGrid,
  tint: startTint,
  // The chosen rail row's label: the accent, darkened as far as it needs to read at AA on its tint.
  chosenInk: chosenLabel,
  // Found in other modes: the other modes' matches for a search, and choosing one switches the tab's mode.
  OtherModes: StartOtherModes,
  sheet: true,
});
