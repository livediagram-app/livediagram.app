'use client';

// The tab bar's Connect a File (liveworkspace/docs/specs/004-index/connected-tabs.md "From the tab bar"): the same
// Connect list as the start screen's Connect File, in a centred dialog, loaded the first time it is pressed. A file
// connected there becomes a new tab at the end of the bar, which opens; no empty tab gives way, and closing the dialog
// leaves nothing behind. Offered only where connecting can work (useConnectHost): `open` is undefined elsewhere.
import dynamic from 'next/dynamic';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { TabBar } from '@/components/chrome/TabBar';
import { track } from '@/lib/telemetry';
import { useConnectHost } from './useConnectHost';

const ConnectFileDialog = dynamic(
  () =>
    import('@liveworkspace/workbench/components/connect/ConnectFilePanel').then(
      (m) => m.ConnectFileDialog,
    ),
  { ssr: false },
);

export function useConnectFileDialog(): { open: (() => void) | undefined; dialog: ReactNode } {
  const host = useConnectHost();
  const [shown, setShown] = useState(false);
  if (!host) return { open: undefined, dialog: null };
  const { addConnectedTab, activeTabId: _active, tabCount: _count, ...panel } = host;
  return {
    open: () => {
      track('Tab', 'Opened', 'ConnectButton');
      setShown(true);
    },
    dialog: shown ? (
      <ConnectFileDialog
        {...panel}
        addTab={(made, tabId) => addConnectedTab(made, tabId)}
        onClose={() => setShown(false)}
      />
    ) : null,
  };
}

// The tab bar with its Connect a File: the bar given its `onConnect`, and the dialog drawn beside it.
export function TabBarWithConnect(props: Omit<ComponentProps<typeof TabBar>, 'onConnect'>) {
  const { open, dialog } = useConnectFileDialog();
  return (
    <>
      <TabBar {...props} onConnect={open} />
      {dialog}
    </>
  );
}
