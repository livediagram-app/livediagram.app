'use client';

// livedocuments's movable panel (docs/specs/007-editor/panel-docking.md): the shared one
// (@liveworkspace/workbench/components/primitives/MovablePanel), made once here with this editor's help-article
// link and the toolbars its popovers opening up stop short of (./usePopoverTopClearance).
import { createMovablePanel } from '@liveworkspace/workbench/components/primitives/MovablePanel';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import type { HelpArticleKey } from '@/lib/help-articles';
import type { MovablePanelProps } from './MovablePanel.types';
import { usePopoverTopClearance } from './usePopoverTopClearance';

export type { MovablePanelDockProps } from './MovablePanel.types';

export const MovablePanel: (props: MovablePanelProps) => React.JSX.Element | null =
  createMovablePanel<HelpArticleKey>({
    HelpArticleLink,
    usePopoverTopClearance,
  });
