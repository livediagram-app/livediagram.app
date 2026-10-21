'use client';

import { useEffect, useRef, useState } from 'react';
import { onPageHide } from '@livediagram/telemetry-client';
import { createVoteTally, type ArticleVote, type VoteTally } from '@/lib/article-vote';
import { track } from '@/lib/telemetry';

/**
 * The article's helpful vote: the UI state plus a tally that reports only
 * the reader's final choice (see lib/article-vote.ts). The tally is rebuilt
 * per article, and the outgoing one is committed as it goes, so a
 * client-side hop to another article reports the vote left on this one.
 */
export function useArticleVote(articleId: string) {
  const [vote, setVote] = useState<ArticleVote | null>(null);
  const tally = useRef<VoteTally | null>(null);

  useEffect(() => {
    const current = createVoteTally(articleId, (action, id) => track('Help', action, id));
    tally.current = current;
    const off = onPageHide(current.commit);
    return () => {
      off();
      current.commit();
    };
  }, [articleId]);

  const cast = (next: ArticleVote) => {
    tally.current?.cast(next);
    setVote(next);
  };

  return { vote, cast };
}
