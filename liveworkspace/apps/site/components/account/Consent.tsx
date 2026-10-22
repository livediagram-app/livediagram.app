'use client';

import { useState } from 'react';
import { call, nextUrl, signedOAuthQuery } from '@/lib/accounts';
import { useLocationSearch } from '@/lib/location-search';
import {
  AccountCard,
  AccountHeading,
  Alert,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from './AccountPage';

// Asking whether an app may use the account (liveworkspace/docs/site.md "Accounts"). Our own apps
// skip this page; it is here for any client registered without that trust.
export function Consent() {
  const client = new URLSearchParams(useLocationSearch()).get('client_id') || 'An app';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function answer(accept: boolean) {
    setError('');
    setBusy(true);
    const next = nextUrl(
      await call('/oauth2/consent', {
        accept,
        oauth_query: signedOAuthQuery(window.location.search),
      }),
    );
    if (next) return window.location.assign(next);
    setBusy(false);
    setError('That request has expired. Go back to the app and try again.');
  }

  return (
    <AccountCard narrow>
      <AccountHeading title="Allow access">
        <strong className="text-slate-900 dark:text-slate-100">{client}</strong> wants to use your
        liveworkspace account.
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
