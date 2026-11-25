'use client';

// Connect as tabs in a Send to picker (liveworkspace/docs/specs/004-index/connected-tabs.md "Linked from a Send to"):
// how the source and the picked destination stand (one read per destination, aborted when another is picked; none
// for a destination still to be made), the switch (on by default), and `finish`, which the picker calls once its send
// succeeded: the index gives each file its tab, and a link that leaves one without says so. A failed link never
// undoes the send.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { IndexClient, LinkedTabsMade } from '@liveworkspace/index-client';
import { workbench } from '../../bindings';
import { useToast } from '../../hooks/ui/useToast';
import { indexClient } from '../../lib/index-client';
import {
  LINK_FAILED_WORDS,
  linkTabsView,
  linkedTabsNotice,
  type LinkTabsNames,
  type LinkTabsState,
  type LinkTabsView,
} from './link-tabs-words';

type Client = Pick<IndexClient, 'linkedTabs' | 'linkTabs'>;

export type LinkTabs = {
  state: LinkTabsState;
  view: LinkTabsView;
  on: boolean;
  setOn: (on: boolean) => void;
  // The destination is the source itself (a tab sent into its own file): nothing to offer, and the row is not shown.
  hidden: boolean;
  // Whether a send now would link: the switch on, and something to add.
  asks: boolean;
  // After the send: link the source with `destinationId` (the one made, for a new file), as the switch says.
  finish: (destinationId: string, names: LinkTabsNames) => Promise<LinkedTabsMade | null>;
};

const NEW: LinkTabsState = { kind: 'new' };
const LOADING: LinkTabsState = { kind: 'loading' };

export function useLinkTabs({
  sourceId,
  targetId,
  client = indexClient,
}: {
  sourceId: string;
  // The destination picked; null while it is still to be made.
  targetId: string | null;
  client?: Client;
}): LinkTabs {
  const toast = useToast();
  const [on, setOn] = useState(true);
  const [answer, setAnswer] = useState<{ target: string; state: LinkTabsState } | null>(null);

  const hidden = targetId === sourceId;
  useEffect(() => {
    if (!targetId || targetId === sourceId) return;
    const abort = new AbortController();
    client
      .linkedTabs(sourceId, targetId, { signal: abort.signal })
      .then(({ source, target }) =>
        setAnswer({ target: targetId, state: { kind: 'ready', source, target } }),
      )
      .catch(() => {
        if (!abort.signal.aborted) setAnswer({ target: targetId, state: { kind: 'failed' } });
      });
    return () => abort.abort();
  }, [client, sourceId, targetId]);

  const state = !targetId ? NEW : answer?.target === targetId ? answer.state : LOADING;
  const view = linkTabsView(state);
  const asks = on && !hidden && view === 'offer';
  // Read when the send lands, not when it began: the dialog may be gone by then.
  const latest = useRef({ asks, client, toast });
  useEffect(() => {
    latest.current = { asks, client, toast };
  });

  const finish = useCallback(
    async (destinationId: string, names: LinkTabsNames) => {
      const now = latest.current;
      if (!now.asks || destinationId === sourceId) return null;
      try {
        const made = await now.client.linkTabs(sourceId, destinationId);
        const tabs = [made.source, made.target].filter((o) => o === 'made').length;
        if (tabs > 0) workbench.track('Tab', 'Added', tabs === 2 ? 'ConnectedBoth' : 'Connected');
        const notice = linkedTabsNotice(made, names);
        if (notice) now.toast[notice.tone](notice.message);
        return made;
      } catch {
        now.toast.warning(LINK_FAILED_WORDS);
        return null;
      }
    },
    [sourceId],
  );

  return { state, view, on, setOn, hidden, asks, finish };
}
