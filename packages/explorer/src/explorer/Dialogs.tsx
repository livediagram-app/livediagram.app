'use client';

// The Explorer's dialogs, one at a time, opened from a menu through the context. Only this shell is in the
// Explorer's first load: the open dialog's code (OpenDialog.tsx) loads from its own chunk, fetched once the page is
// idle and as a menu opens (lazy-dialogs.ts), so a press finds it in and the dialog opens in the press's own commit.
// liveworkspace/docs/specs/010-site/blueprints/site.md "Performance and limits".

import { useEffect } from 'react';
import { useExplorer } from './context';
import { OpenDialog, preloadExplorerDialogs } from './lazy-dialogs';
import { whenIdle } from './when-idle';

export function ExplorerDialogs() {
  const { dialog } = useExplorer();
  useEffect(() => whenIdle(() => void preloadExplorerDialogs()), []);
  return dialog ? <OpenDialog /> : null;
}
