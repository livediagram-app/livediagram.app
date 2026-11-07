'use client';

// Connect File on Start Planning (liveworkspace/docs/specs/004-index/connected-tabs.md "Connecting"): the
// shared list, loaded and mounted only once the person chooses the entry, so the start's first paint and its one read
// of Recent wait for that choice. Offered only where connecting can work: signed in, the plan on the server, and a
// session that may change its tabs (not a tab-scoped link's, an embed's, a workbench's or a viewer's).
import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { useOptionalEditorContext } from '@/app/project/[id]/EditorContext';
import { useIsOfflineProject } from '@/hooks/persistence/useIsOfflineProject';
import type { PlanPalette } from '@/components/plan/plan-palette';

const ConnectFilePanel = dynamic(
  () =>
    import('@liveworkspace/workbench/components/connect/ConnectFilePanel').then(
      (m) => m.ConnectFilePanel,
    ),
  { ssr: false },
);

export function useConnectStart(): ((palette: PlanPalette) => ReactNode) | undefined {
  const ctx = useOptionalEditorContext();
  const offline = useIsOfflineProject(ctx?.projectId ?? null);
  if (!ctx) return undefined;
  const {
    accountUserId,
    projectId,
    isStructureReadOnly,
    embedMode,
    workbenchMode,
    sessionShareCode,
    connectedTabs,
    activeTab,
    tabs,
  } = ctx;
  if (!accountUserId || !projectId || offline || isStructureReadOnly || embedMode || workbenchMode)
    return undefined;
  return (palette) => (
    <ConnectFilePanel
      hostId={projectId}
      hostKind="plan"
      // Its owner or a member of its team opens it without a link: they manage its links, which both ways needs.
      hostManaged={sessionShareCode === null}
      connected={connectedTabs.connected}
      // The rail's chosen ink is the palette's focus colour (StartPanel's rail).
      ink={{ ...palette, accent: palette.focus }}
      grant={connectedTabs.grant}
      newTabId={() => crypto.randomUUID()}
      // The empty tab this start is on gives way to the connected tab, unless it is the plan's only tab.
      addTab={(made, tabId) =>
        connectedTabs.addConnectedTab(made, tabId, tabs.length > 1 ? activeTab.id : undefined)
      }
      onConnected={connectedTabs.showConnected}
      onGoTo={connectedTabs.goTo}
    />
  );
}
