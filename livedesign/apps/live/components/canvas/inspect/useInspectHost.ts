'use client';

import { useEffect, useMemo, useRef } from 'react';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { Tab } from '@livedesign/design';
import type { CanvasTool } from '@/components/palette/palette.types';
import { useIsOfflineDesign } from '@/hooks/persistence/useIsOfflineDesign';
import { useToast } from '@/hooks/ui/useToast';
import { shareAddress } from '@/lib/explorer-host';
import { exportInspectedElement, inspectExportName } from '@/lib/inspect-export';
import { wantsInspect, withInspect } from '@/lib/inspect-link';
import { copyFlaggedViewLink } from '@/lib/copy-flagged-view-link';
import { track } from '@/lib/telemetry';
import type { InspectSession } from './InspectSessionContext';

type HostInput = {
  canvasTool: CanvasTool;
  setCanvasTool: (tool: CanvasTool) => void;
  // The tab's pages are wireframe pages (its first page's kind).
  wireframeTab: boolean;
  // The design and its active tab are loaded, so a link's `inspect` can be honoured.
  ready: boolean;
  activeTab: Tab;
  designId: string | null;
  designName: string;
  sessionShareCode: string | null;
  canShareDesign: boolean;
  openShare: () => void;
  imageContext?: { ownerId: string; designId: string; shareCode: string | null };
};

// Inspect's editor side (docs/specs/007-editor/wireframe-pages.md "Inspect"): opens a wireframe tab with Inspect when
// the address asks (`?inspect`), leaves Inspect when the tab is not a wireframe tab, and builds the panel's session:
// exporting an element and copying the link that opens with Inspect.
export function useInspectHost(input: HostInput): InspectSession {
  const latest = useLatest(input);
  const toast = useToast();
  const offline = useIsOfflineDesign(input.designId);
  const { canvasTool, setCanvasTool, wireframeTab, ready } = input;

  // The address is read once, as the design opens.
  const asked = useRef<boolean | null>(null);
  useEffect(() => {
    if (!ready || asked.current === false) return;
    asked.current ??= wantsInspect(window.location.search);
    if (asked.current && wireframeTab) setCanvasTool('inspect');
    asked.current = false;
  }, [ready, wireframeTab, setCanvasTool]);

  // Inspect belongs to a wireframe tab: moving to any other leaves it.
  useEffect(() => {
    if (ready && canvasTool === 'inspect' && !wireframeTab) setCanvasTool('select');
  }, [ready, canvasTool, wireframeTab, setCanvasTool]);

  const hasLink = input.sessionShareCode !== null || (input.canShareDesign && !offline);
  return useMemo<InspectSession>(
    () => ({
      exportElement: async ({ el, elementName, format, scale, surface }) => {
        const now = latest.current;
        await exportInspectedElement({
          tab: now.activeTab,
          el,
          format,
          scale,
          surface,
          fileName: inspectExportName(now.designName, elementName, scale, format),
          imageContext: now.imageContext,
        });
        track('Document', 'Exported', format === 'png' ? 'InspectPng' : 'InspectSvg');
      },
      copyLink: hasLink
        ? async () => {
            const now = latest.current;
            const copied = await copyFlaggedViewLink({
              sessionShareCode: now.sessionShareCode,
              designId: now.designId,
              tabId: now.activeTab.id,
              withFlag: withInspect,
              shareAddress,
              listShareLinks: (id) => indexClient.listShareLinks(id),
              writeClipboard: (text) => navigator.clipboard.writeText(text),
              openShare: now.openShare,
              toast,
              link: 'Inspect link',
              copied: 'Copied a link that opens with Inspect',
              makeFirst: 'Make a Viewer link, then copy the Inspect link.',
            });
            if (copied) track('UI', 'Copied', 'InspectLink');
          }
        : null,
    }),
    [hasLink, latest, toast],
  );
}
