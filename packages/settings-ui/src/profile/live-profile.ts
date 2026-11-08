'use client';

import { useEffect, useState } from 'react';
import type { ProfileHost } from './profile-host';
import { onProfileSaved } from './profile-events';

// The Profile's header card shows the name and colour collaborators see. What the host hands it when the panel opens
// can be stale or missing (an editor's session has no colour), so where the panel can edit the profile the card reads
// it from the same host and follows each save, as the Name and Colour editor beside it does.

/** The display name (null: the account's own) and colour (null: Automatic), as the accounts API answers them. */
export type LiveProfile = { name: string | null; color: string | null };

/** The profile as it now is, or null until it is read (and with no host, or when the read fails). */
export function useLiveProfile(host: ProfileHost | undefined): LiveProfile | null {
  const [profile, setProfile] = useState<LiveProfile | null>(null);
  useEffect(() => {
    if (!host) return;
    let live = true;
    void host.load().then(
      (result) => {
        if (live && result.ok && result.data) {
          setProfile({ name: result.data.name, color: result.data.color });
        }
      },
      () => {},
    );
    const stop = onProfileSaved((saved) => setProfile({ name: saved.name, color: saved.color }));
    return () => {
      live = false;
      stop();
    };
  }, [host]);
  return profile;
}
