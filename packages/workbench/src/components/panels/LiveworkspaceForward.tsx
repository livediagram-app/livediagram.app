'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { siteUrl } from '@liveworkspace/sites';
import { withoutTrailingSlashes } from '@liveworkspace/api-schema/url-slashes';
import { ManagedOnLiveworkspace } from './ManagedOnLiveworkspace';

// An old link of an editor's that liveworkspace.app answers now (a team's join link, an invite's Decline), forwarded
// there with its query (liveworkspace/docs/specs/003-accounts/accounts.md "The join link", "Invitations"): siteUrl
// keeps a dev server on the local liveworkspace port, and NEXT_PUBLIC_ACCOUNTS_SITE_URL points a staging build at
// staging. The card is the fallback if the forward doesn't run.
const siteBase = () =>
  withoutTrailingSlashes(
    process.env.NEXT_PUBLIC_ACCOUNTS_SITE_URL ||
      siteUrl('liveworkspace.app', 'https://www.liveworkspace.app'),
  );

const noSubscribe = () => () => {};
const readSearch = () => window.location.search;
const serverSearch = () => '';

export function LiveworkspaceForward({
  path,
  title,
  body,
  cta,
}: {
  /** The path on liveworkspace.app that answers the link (`/join`). */
  path: string;
  title: string;
  body: string;
  cta: string;
}) {
  const search = useSyncExternalStore(noSubscribe, readSearch, serverSearch);
  const url = `${siteBase()}${path}`;

  useEffect(() => {
    window.location.replace(`${url}${window.location.search}`);
  }, [url]);

  return <ManagedOnLiveworkspace title={title} body={body} href={`${url}${search}`} cta={cta} />;
}
