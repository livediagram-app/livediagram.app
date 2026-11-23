'use client';

// Connect File on a start screen (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting"): the
// shared list, loaded and mounted only once the person chooses the entry, so the start screen's first paint and its
// one read of Recent wait for that choice. Offered only where connecting can work (useConnectHost).
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import type { StartPalette } from '@/components/start/start-palette';
import { useConnectHost } from './useConnectHost';

const ConnectFilePanel = dynamic(
  () =>
    import('@liveworkspace/workbench/components/connect/ConnectFilePanel').then(
      (m) => m.ConnectFilePanel,
    ),
  { ssr: false },
);

export function useConnectStart(): ((palette: StartPalette) => ReactNode) | undefined {
  const host = useConnectHost();
  if (!host) return undefined;
  const { addConnectedTab, activeTabId, tabCount, ...panel } = host;
  return (palette) => (
    <ConnectFilePanel
      {...panel}
      // The accent is the start panel's chosen ink: its focus colour, as the rail's chosen row has it.
      ink={{ ...palette, accent: palette.focus }}
      // The empty tab this start is on gives way to the connected tab, unless it is the document's only tab.
      addTab={(made, tabId) => addConnectedTab(made, tabId, tabCount > 1 ? activeTabId : undefined)}
    />
  );
}
