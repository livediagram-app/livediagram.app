'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { siteUrl } from '@liveworkspace/sites';
import { ManagedOnLiveworkspace } from '@/components/panels/ManagedOnLiveworkspace';

// /join/decline?token=… — where an invite email's Decline link used to land. Invitations are answered
// on liveworkspace.app now (liveworkspace/docs/accounts.md "Invitations"), so an old link forwards
// there with its token: siteUrl keeps a dev server on the local liveworkspace port, and
// NEXT_PUBLIC_ACCOUNTS_SITE_URL points a staging build at staging. The card is the fallback if the
// forward doesn't run. `index: false` is inherited from the root layout.
const DECLINE_URL = `${(process.env.NEXT_PUBLIC_ACCOUNTS_SITE_URL || siteUrl('liveworkspace.app', 'https://liveworkspace.app')).replace(/\/+$/, '')}/join/decline`;

const noSubscribe = () => () => {};
const readSearch = () => window.location.search;
const serverSearch = () => '';

export default function DeclineInvitePage() {
  const search = useSyncExternalStore(noSubscribe, readSearch, serverSearch);
  const target = `${DECLINE_URL}${search}`;

  useEffect(() => {
    window.location.replace(`${DECLINE_URL}${window.location.search}`);
  }, []);

  return (
    <ManagedOnLiveworkspace
      title="Invitations are on liveworkspace.app"
      body="Team invitations are answered on liveworkspace.app. Taking you there to decline this invite."
      href={target}
      cta="Decline on liveworkspace.app"
    />
  );
}
