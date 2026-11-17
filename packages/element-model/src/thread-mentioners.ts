// Who mentioned each person in a comment thread (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "What an
// item pushes", `mentionedBy`): the author of the latest comment that mentioned them, so a reply after it, theirs or
// anyone's, never changes who mentioned them. A comment mentioning its own author names no one. One pass over the
// thread's comments, in any order.

export type ThreadMentioner = { id: string | null; name: string; color?: string };

type MentioningComment = {
  createdAt: number;
  authorId?: string | null;
  authorName: string;
  authorColor?: string;
};

/** Each mentioned id's mentioner, or undefined when nobody in the thread mentioned anyone else. */
export function mentionedByOf<C extends MentioningComment>(
  comments: readonly C[],
  idsOf: (c: C) => Iterable<string | null | undefined>,
): Record<string, ThreadMentioner> | undefined {
  const by = new Map<string, { at: number; who: ThreadMentioner }>();
  for (const c of comments) {
    for (const id of idsOf(c)) {
      if (!id || id === c.authorId) continue;
      const held = by.get(id);
      if (held && held.at > c.createdAt) continue;
      by.set(id, {
        at: c.createdAt,
        who: {
          id: c.authorId || null,
          name: c.authorName,
          ...(c.authorColor ? { color: c.authorColor } : {}),
        },
      });
    }
  }
  if (by.size === 0) return undefined;
  return Object.fromEntries([...by].map(([id, { who }]) => [id, who]));
}

/** A comment's mentioned ids, as element-model's comments carry them (a person's user id and a team member's id). */
export function* mentionIdsOf(c: {
  mentions?: readonly { userId?: string | null; memberId?: string }[];
}): Iterable<string | null | undefined> {
  for (const m of c.mentions ?? []) {
    yield m.userId;
    yield m.memberId;
  }
}

/** A thread row's `mentionedBy`, spread in only when there is one, so a thread nobody was mentioned in pushes as before. */
export const withMentionedBy = (
  by: Record<string, ThreadMentioner> | undefined,
): { mentionedBy?: Record<string, ThreadMentioner> } => (by ? { mentionedBy: by } : {});
