// The "Was this article helpful?" vote (spec/55), as telemetry (spec/22).
//
// A reader can change their mind: tap "Not really", read on, tap "Yes, it
// helped". Emitting on every tap counted that reader twice, once on each
// side, and the counters are append-only so the first tap can't be taken
// back. So the tally HOLDS the choice and sends only the one standing when
// the reader leaves: the article unmounts (a client-side navigation) or the
// page is hidden / unloaded (the host wires that to `onPageHide`, which runs
// ahead of the engine's own last flush).
//
// `sent` remembers what already reached the wire for this article, so hiding
// the tab twice with the same vote standing never counts it twice. The one
// residual double count is a reader who votes, switches tabs (which sends),
// comes back and flips the vote: that sends the new side too. Rare enough to
// accept, and documented in spec/22's Help entry.

export type ArticleVote = 'yes' | 'no';

export type VoteTally = {
  /** Record the reader's current choice; nothing is sent yet. */
  cast: (vote: ArticleVote) => void;
  /** Send the standing choice if it hasn't been sent already. */
  commit: () => void;
};

export function createVoteTally(
  articleId: string,
  emit: (action: 'Helpful' | 'Unhelpful', articleId: string) => void,
): VoteTally {
  let standing: ArticleVote | null = null;
  let sent: ArticleVote | null = null;
  return {
    cast(vote) {
      standing = vote;
    },
    commit() {
      if (!articleId || standing === null || standing === sent) return;
      sent = standing;
      emit(standing === 'yes' ? 'Helpful' : 'Unhelpful', articleId);
    },
  };
}
