'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { siteUrl } from '@liveworkspace/sites';
import { ManagedOnLiveworkspace } from '@liveworkspace/workbench/components/panels/ManagedOnLiveworkspace';

// /join?token=… — where a team's join link used to land (docs/specs/013-workspace/teams.md). Teams
// are run on liveworkspace.app now (liveworkspace/docs/specs/003-accounts/accounts.md "The join link"), so an old link
// forwards there with its token: siteUrl keeps a dev server on the local liveworkspace port, and
// NEXT_PUBLIC_ACCOUNTS_SITE_URL points a staging build at staging. The card is the fallback if the
// forward doesn't run. `index: false` is inherited from the root layout.
const JOIN_URL = `${(process.env.NEXT_PUBLIC_ACCOUNTS_SITE_URL || siteUrl('liveworkspace.app', 'https://www.liveworkspace.app')).replace(/\/+$/, '')}/join`;

const noSubscribe = () => () => {};
const readSearch = () => window.location.search;
const serverSearch = () => '';

export default function JoinPage() {
  const search = useSyncExternalStore(noSubscribe, readSearch, serverSearch);
  const target = `${JOIN_URL}${search}`;

  useEffect(() => {
    window.location.replace(`${JOIN_URL}${window.location.search}`);
  }, []);

  return (
    <ManagedOnLiveworkspace
      title="Teams are on liveworkspace.app"
      body="Your teams work in every liveworkspace app. Taking you to liveworkspace.app to join this team."
      href={target}
      cta="Join on liveworkspace.app"
    />
  );
}
