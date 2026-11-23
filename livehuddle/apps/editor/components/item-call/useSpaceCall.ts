'use client';

// Whether this Space is a call about an item (docs/specs/012-collaboration/calls-from-items.md "In the call"): read once
// when the Space opens in the cloud, then again after a summary is sent. A Space that is no call answers null and
// costs that one read. The first answer that is a call says, once a session, what the call is about and that it isn't
// recorded (livehuddle records nothing).
import { useCallback, useEffect, useState } from 'react';
import type { ShareAccess, SpaceCall } from '@liveworkspace/index-client';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { useToast } from '@/hooks/ui/useToast';

type Reader = Pick<typeof indexClient, 'spaceCall'>;

const noticeKey = (spaceId: string) => `lh-call-notice:${spaceId}`;

/** Whether this session already said the call's notice, remembering it now if not. */
export function firstNotice(spaceId: string): boolean {
  try {
    if (sessionStorage.getItem(noticeKey(spaceId))) return false;
    sessionStorage.setItem(noticeKey(spaceId), '1');
  } catch {
    // No session storage (a private window's limits): say it each open.
  }
  return true;
}

/** The notice: "This call is about Retro. It isn't recorded." */
export const callNotice = (call: Pick<SpaceCall, 'item'>): string =>
  `This call is about ${call.item.title || 'an item'}. It isn’t recorded.`;

export function useSpaceCall(
  spaceId: string | null,
  share: ShareAccess | null,
  reader: Reader = indexClient,
): { call: SpaceCall | null; reread: () => void } {
  // The answer, kept with the Space it is for, so another Space (or none) shows nothing until its own read lands.
  const [read, setRead] = useState<{ spaceId: string; call: SpaceCall | null } | null>(null);
  const [round, setRound] = useState(0);
  const toast = useToast();
  const code = share?.code ?? null;

  useEffect(() => {
    if (!spaceId) return;
    const abort = new AbortController();
    reader
      .spaceCall(spaceId, { share: code ? { code } : null, signal: abort.signal })
      .then(({ call }) => {
        if (abort.signal.aborted) return;
        setRead({ spaceId, call });
        if (call && round === 0 && firstNotice(spaceId)) toast.info(callNotice(call));
      })
      .catch(() => {
        // Offline or refused: no call card; the Space works as ever.
      });
    return () => abort.abort();
  }, [spaceId, code, reader, round, toast]);

  const reread = useCallback(() => setRound((n) => n + 1), []);
  return { call: spaceId && read?.spaceId === spaceId ? read.call : null, reread };
}
