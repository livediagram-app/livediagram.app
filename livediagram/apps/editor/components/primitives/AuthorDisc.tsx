'use client';

import type { ComponentProps } from 'react';
import { PictureDisc } from '@livediagram/ui';
import { useCommentAuthorPicture } from '@/lib/comment-pictures';

// A comment author's disc (docs/specs/014-identity/profile-picture.md §5): their initials, with
// their published picture over it when the reader is signed in and the author has one.
export function AuthorDisc({
  commentId,
  authorId,
  ...disc
}: Omit<ComponentProps<typeof PictureDisc>, 'pictureUrl'> & {
  commentId: string;
  authorId?: string;
}) {
  return <PictureDisc pictureUrl={useCommentAuthorPicture(commentId, authorId)} {...disc} />;
}
