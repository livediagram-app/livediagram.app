'use client';

import { useState } from 'react';
import { afterSignIn, call, nextUrl, signedOAuthQuery } from '@/lib/accounts';
import { useLocationSearch } from '@/lib/location-search';
import {
  AccountCard,
  AccountHeading,
  Alert,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from './AccountPage';

// Asking whether an app may use the account (liveworkspace/docs/specs/010-site/site.md "Accounts"). Our own apps
// skip this page; it is here for any client registered without that trust.
export function Consent() {
  const client = new URLSearchParams(useLocationSearch()).get('client_id') || 'An app';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function answer(accept: boolean) {
    setError('');
    setBusy(true);
    const result = await call('/oauth2/consent', {
      accept,
      oauth_query: signedOAuthQuery(window.location.search),
    });
    const next = nextUrl(result);
    // Under an app's address, by way of liveworkspace.app (lib/accounts.ts afterSignIn).
    if (next) return window.location.assign(await afterSignIn(next, window.location.search));
    setBusy(false);
    // No answer at all (status 0) is the connection, not the request: the same answer works once it is back.
    setError(
      result.status === 0
        ? 'Couldn’t reach liveworkspace. Check your connection and try again.'
        : 'That request has expired. Go back to the app and try again.',
    );
  }

  return (
    <AccountCard narrow>
      <AccountHeading title="Allow access">
        {/* A client id is one unbroken word, up to whatever its maker chose: it wraps rather than leaving the card.
            It comes from the address, so it is isolated (<bdi>): a right-to-left override in it turned the whole
            sentence after it backwards. */}
        <strong className="break-all text-slate-900 dark:text-slate-100">
          <bdi>{client}</bdi>
        </strong>{' '}
        wants to use your liveworkspace account.
      </AccountHeading>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void answer(false)}
          disabled={busy}
          className={SECONDARY_BUTTON}
        >
          Deny
        </button>
        <button
          type="button"
          onClick={() => void answer(true)}
          disabled={busy}
          className={PRIMARY_BUTTON}
        >
          Allow
        </button>
      </div>
    </AccountCard>
  );
}
