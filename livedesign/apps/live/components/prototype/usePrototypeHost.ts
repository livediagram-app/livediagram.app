'use client';

// Prototype mode's editor side (docs/specs/007-editor/wireframe-pages.md "Prototype mode", "Sharing a prototype"):
// opens the player when the address asks (`?prototype`) on a wireframe tab, closes it when the tab stops being one or
// the editor goes, frames the screen last shown on Close, and builds Copy Prototype Link.
import { useEffect, useMemo, useRef } from 'react';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { useIsOfflineDesign } from '@/hooks/persistence/useIsOfflineDesign';
import { useToast } from '@/hooks/ui/useToast';
import { copyFlaggedViewLink } from '@/lib/copy-flagged-view-link';
import { shareAddress } from '@/lib/explorer-host';
import { wantsPrototype, withPrototype } from '@/lib/prototype-link';
import {
  closePrototype,
  openPrototype,
  usePrototypePlayer,
  type PrototypePlayerState,
} from '@/lib/prototype-player-store';
import { track } from '@/lib/telemetry';

type HostInput = {
  // The tab's pages are wireframe pages (its first page's kind).
  wireframeTab: boolean;
  // The design and its active tab are loaded, so a link's `prototype` can be honoured.
  ready: boolean;
  tabId: string;
  designId: string | null;
  sessionShareCode: string | null;
  canShareDesign: boolean;
  openShare: () => void;
  // Frames a page on the canvas (Pages mode's focusPage).
  focusPage: (pageId: string) => void;
};

export type PrototypeHost = PrototypePlayerState & {
  close: (shownId: string) => void;
  copyLink: (() => void) | null;
};

export function usePrototypeHost(input: HostInput): PrototypeHost {
  const latest = useLatest(input);
  const toast = useToast();
  const offline = useIsOfflineDesign(input.designId);
  const player = usePrototypePlayer();
  const { wireframeTab, ready } = input;

  // The address is read once, as the design opens.
  const asked = useRef<boolean | null>(null);
  useEffect(() => {
    if (!ready || asked.current === false) return;
    asked.current ??= wantsPrototype(window.location.search);
    if (asked.current && wireframeTab) openPrototype(null);
    asked.current = false;
  }, [ready, wireframeTab]);

  // The player belongs to a wireframe tab, and to this editor.
  useEffect(() => {
    if (ready && player.open && !wireframeTab) closePrototype();
  }, [ready, player.open, wireframeTab]);
  useEffect(() => () => closePrototype(), []);

  const hasLink = input.sessionShareCode !== null || (input.canShareDesign && !offline);
  const actions = useMemo(
    () => ({
      close: (shownId: string) => {
        closePrototype();
        latest.current.focusPage(shownId);
      },
      copyLink: hasLink
        ? () => {
            const now = latest.current;
            void copyFlaggedViewLink({
              sessionShareCode: now.sessionShareCode,
              designId: now.designId,
              tabId: now.tabId,
              withFlag: withPrototype,
              shareAddress,
              listShareLinks: (id) => indexClient.listShareLinks(id),
              writeClipboard: (text) => navigator.clipboard.writeText(text),
              openShare: now.openShare,
              toast,
              copied: 'Copied a link that opens the prototype',
              makeFirst: 'Make a Viewer link, then copy the Prototype link.',
            }).then((copied) => {
              if (copied) track('UI', 'Copied', 'PrototypeLink');
            });
          }
        : null,
    }),
    [hasLink, latest, toast],
  );
  return { ...player, ...actions };
}
