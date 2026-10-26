'use client';

// The Explorer's Search panel (liveworkspace/docs/specs/010-site/site.md "The Explorer", Search): the shared panel
// (@liveworkspace/explorer/search-panel) with this site's own entries, help and settings (lib/explorer/search.ts).
// ExplorerShell loads this module only when the panel first opens.

import { useMemo } from 'react';
import { SearchPanel, type SearchPanelProps } from '@liveworkspace/explorer/search-panel';
import type { AppName } from '@liveworkspace/sites';
import { searchEntries } from '@/lib/explorer/search';

export default function ExplorerSearch({
  helpApp,
  signedIn,
  ...props
}: Omit<SearchPanelProps, 'entries'> & { helpApp: AppName; signedIn: boolean }) {
  const entries = useMemo(() => searchEntries(helpApp, signedIn), [helpApp, signedIn]);
  return <SearchPanel {...props} entries={entries} />;
}
