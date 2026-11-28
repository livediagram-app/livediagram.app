// What a comment may say it is (docs/specs/026-plan/items.md "Review Feedback"): `review` for feedback left in a
// Sprint Review session. Its own module so the comment checks (element-deltas.ts) and the shape (comments.ts) share it
// without a cycle. Pure.
export const COMMENT_LABELS = ['review'] as const;
export type CommentLabel = (typeof COMMENT_LABELS)[number];
export const isCommentLabel = (v: unknown): v is CommentLabel =>
  (COMMENT_LABELS as readonly unknown[]).includes(v);
