'use client';

import type { ComponentProps } from 'react';
import { PictureDisc } from '@liveplanner/ui';
import { useDeferredAuth } from '@/components/providers/deferred-auth';

// A comment author's disc (docs/specs/014-identity/profile-picture.md §5): their initials, with our
// own picture over it on our own comments when we are signed in. Other authors' pictures are not
// looked up, so their comments show their initials.
export function AuthorDisc({
  authorId,
  ...disc
}: Omit<ComponentProps<typeof PictureDisc>, 'pictureUrl'> & {
  authorId?: string;
}) {
  const { isSignedIn, userId, user } = useDeferredAuth();
  const own = isSignedIn && !!authorId && authorId === userId;
  return <PictureDisc pictureUrl={own ? (user?.pictureUrl ?? null) : null} {...disc} />;
}
