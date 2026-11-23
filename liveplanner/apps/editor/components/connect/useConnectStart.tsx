'use client';

// Connect File on Start Planning (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting"): the
// shared list, loaded and mounted only once the person chooses the entry, so the start's first paint and its one read
// of Recent wait for that choice. Offered only where connecting can work (useConnectHost).
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import type { PlanPalette } from '@/components/plan/plan-palette';
import { useConnectHost } from './useConnectHost';

const ConnectFilePanel = dynamic(
  () =>
    import('@liveworkspace/workbench/components/connect/ConnectFilePanel').then(
      (m) => m.ConnectFilePanel,
    ),
  { ssr: false },
);

export function useConnectStart(): ((palette: PlanPalette) => ReactNode) | undefined {
  const host = useConnectHost();
  if (!host) return undefined;
  const { addConnectedTab, activeTabId, tabCount, ...panel } = host;
  return (palette) => (
    <ConnectFilePanel
      {...panel}
      // The rail's chosen ink is the palette's focus colour (StartPanel's rail).
      ink={{ ...palette, accent: palette.focus }}
      // The empty tab this start is on gives way to the connected tab, unless it is the plan's only tab.
      addTab={(made, tabId) => addConnectedTab(made, tabId, tabCount > 1 ? activeTabId : undefined)}
    />
  );
}
