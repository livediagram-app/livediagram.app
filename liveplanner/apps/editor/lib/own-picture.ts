'use client';

// The signed-in person's own Google picture (docs/specs/014-identity/profile-and-email-notifications.md "Profile
// pictures"), from the session (apps/api/src/routes/auth.ts reads it off the ID token). `picture` is what their own
// screen shows, always; `published` is what the room may show everyone else: the same picture while Show My Google
// Picture is on, else null. Switching it in Settings › Profile takes effect at once (onProfileSaved), before the
// next token says so.

import { useEffect, useState } from 'react';
import { useDeferredAuth } from '@liveworkspace/workbench/components/providers/deferred-auth';
import { onProfileSaved } from '@liveworkspace/settings-ui/profile-events';
import { profilePictureOf } from '@liveworkspace/sites/picture';

/** Pure: the picture collaborators may see, given the session's picture and the switch. */
export function publishedPicture(
  signedIn: boolean,
  picture: string | null | undefined,
  showPicture: boolean,
): string | null {
  return signedIn && showPicture ? profilePictureOf(picture) : null;
}

export function useOwnPicture(): { picture: string | null; published: string | null } {
  const { isSignedIn, user } = useDeferredAuth();
  // The switch as Settings last saved it on this page; null until then (the session's own word stands).
  const [savedShow, setSavedShow] = useState<boolean | null>(null);
  useEffect(
    () =>
      onProfileSaved((saved) => {
        if (typeof saved.showPicture === 'boolean') setSavedShow(saved.showPicture);
      }),
    [],
  );
  const picture = isSignedIn ? profilePictureOf(user?.picture) : null;
  const show = savedShow ?? user?.pictureHidden !== true;
  return { picture, published: publishedPicture(isSignedIn, picture, show) };
}
