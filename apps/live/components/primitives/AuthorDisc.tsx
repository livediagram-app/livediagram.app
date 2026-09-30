'use client';

import type { ComponentProps } from 'react';
import { PictureDisc } from '@/components/primitives/PictureDisc';
import { useParticipantPicture } from '@/lib/participant-pictures';

// A comment author's disc (docs/specs/014-identity/profile-picture.md §5): their initials, with
// their published picture over it when the viewer is signed in and the author has one.
export function AuthorDisc({
  authorId,
  ...disc
}: Omit<ComponentProps<typeof PictureDisc>, 'pictureUrl'> & { authorId?: string }) {
  return <PictureDisc pictureUrl={useParticipantPicture(authorId)} {...disc} />;
}
