'use client';

import dynamic from 'next/dynamic';
import { explorerLoader } from '@liveworkspace/workbench/components/panels/explorer-loader';
import { loadExplorerPanel } from '@/lib/editor-deferred-code';
import type { ExplorerProps } from './Explorer.types';

// The Explorer panel, loaded the first time it is drawn (explorer-loader says why); a load that fails draws nothing.
export const LazyExplorer = dynamic(explorerLoader<ExplorerProps>(loadExplorerPanel), {
  ssr: false,
});
