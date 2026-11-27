'use client';

// The last seen copy keeps the knowledgebase's style as it is now (docs/specs/030-knowledgebase/page-surface.md
// "Themed from the first frame", Work Tracker 1521): a warm open paints the copy, so a copy holding an older style
// would open in it and then turn. The style the open read is what the copy already holds, so only a change after it
// (made here, or an Editor's change through the room) is followed: no write on every open.
import { useEffect, useRef } from 'react';
import type { LiveDoc } from '@liveknowledge/api-schema';
import type { LastSeenFollower } from '@liveworkspace/workbench/lib/api/last-seen-follower';
import { useKnowledgeStyle } from '@/lib/knowledge-style/knowledge-style-store';

export function useKnowledgeStyleCopyFollow({
  follower,
  reader,
  documentId,
  following,
}: {
  follower: Pick<LastSeenFollower<LiveDoc>, 'followItem'>;
  reader: string;
  documentId: string | null;
  // Hydrated, server stored, not an embed and not a workbench: the copy's own gate (useLastSeenFollow's).
  following: boolean;
}): void {
  const style = useKnowledgeStyle(documentId);
  // The style the copy was kept with: the first one seen while following this knowledgebase.
  const kept = useRef<{ id: string; style: unknown } | null>(null);
  useEffect(() => {
    if (!following || !documentId) return;
    if (kept.current?.id !== documentId) {
      kept.current = { id: documentId, style };
      return;
    }
    if (kept.current.style === style) return;
    kept.current = { id: documentId, style };
    follower.followItem(reader, documentId, { knowledgeStyle: style });
  }, [follower, reader, documentId, following, style]);
}
