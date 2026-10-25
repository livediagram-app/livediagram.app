'use client';

import { createContext, useContext } from 'react';

// Whether elements show their comment-count badge. Off for a viewer in an embed
// (docs/specs/013-workspace/embeds.md): a reader of an embedded document has no comments panel to open, so
// the badge is only clutter on the picture. Comment pins and comment panels are content and stay.
export const CommentBadgesContext = createContext(true);

export function useCommentBadges(): boolean {
  return useContext(CommentBadgesContext);
}
