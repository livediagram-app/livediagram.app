'use client';

// Contents docked as a sidebar down the canvas's left (docs/specs/007-editor/pages-mode.md
// "Contents"): the shared sidebar (@liveworkspace/workbench/components/canvas/PageContentsSidebar)
// with this editor's Add Page. Where it sits is useContentsChrome's.
import { useState } from 'react';
import {
  CONTENTS_SIDEBAR_SETTLE_MS,
  ContentsSidebar,
} from '@liveworkspace/workbench/components/canvas/PageContentsSidebar';
import type { PageThumbTab } from '@/hooks/ui/usePageThumbnails';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import { usePageContents } from '@/hooks/ui/usePageContents';
import { ContentsAddPage } from './ContentsAddPage';

export function PageContentsSidebar({
  view,
  tab,
  ...placement
}: {
  view: PagesModeView;
  tab: PageThumbTab;
  // Where it starts, in screen px from the canvas's top: below the Toolbar strip.
  top: number;
  onMinimise: () => void;
  // Joined to the menu box above it (docs/specs/007-editor/pages-mode.md "Joined to the menu box").
  joined?: boolean;
}) {
  // Opened on the tab's first page; the sidebar then follows the page in view.
  const [here] = useState<string | undefined>(() => view.pages[0]?.id);
  const contents = usePageContents({ view, tab, here, settleMs: CONTENTS_SIDEBAR_SETTLE_MS });
  return (
    <ContentsSidebar
      contents={contents}
      pages={view.pages}
      focusPage={view.focusPage}
      footer={(end) => <ContentsAddPage contents={contents} end={end} />}
      {...placement}
    />
  );
}
