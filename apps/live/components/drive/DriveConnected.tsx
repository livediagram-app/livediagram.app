'use client';

// /drive/connected: where Google sends the user back after consent
// (docs/specs/022-drive-mirror/drive-mirror.md, "Connecting"). The code and
// the state go to the api, which checks the state, redeems the code and
// stores the sealed refresh token; then the user goes back to where they
// connected from, and the mirror starts on that page. A consent from another
// Google account than the one Cloud Sync uses asks first
// (DriveAccountSwitchDialog).

import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  apiCancelDriveAccountSwitch,
  apiConfirmDriveAccountSwitch,
  apiDriveConnect,
} from '@/lib/api-client';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { markConnectCancelled, markConnectConnected, takeConsent } from '@/lib/drive/consent';
import { driveLog, driveWarn } from '@/lib/drive/log';
import { track } from '@/lib/telemetry';
import { Body, Heading, LandingCard, PrimaryLink } from '@/components/chrome/LandingCard';
import { DriveAccountSwitchDialog } from './DriveAccountSwitchDialog';

type Query = { code: string | null; state: string | null; error: string | null } | undefined;

const noSubscription = () => () => {};
let cachedSearch = '';
let cachedQuery: Query;
const readQuery = (): Query => {
  if (window.location.search !== cachedSearch || !cachedQuery) {
    cachedSearch = window.location.search;
    const p = new URLSearchParams(cachedSearch);
    cachedQuery = { code: p.get('code'), state: p.get('state'), error: p.get('error') };
  }
  return cachedQuery;
};
const beforeHydration = (): Query => undefined;

// A code redeems once; React may run an effect twice in development.
const redeemed = new Set<string>();

const CLOUD_SYNC_HREF = '/explorer?settings=account&section=cloud-sync';

// `switch`: the consent came from another Google account; `returnPath` is
// where to go once the owner answers.
type Phase = 'working' | 'denied' | 'invalid' | 'failed' | { kind: 'switch'; returnPath: string };

// Redeem the code once; the phase to show, or null while leaving the page.
async function redeem(query: NonNullable<Query>, ownerId: string): Promise<Phase | null> {
  if (query.error) {
    driveLog('consent-refused', { error: query.error });
    // Back to exactly where they started, Cloud Sync open, saying so calmly.
    const back = takeConsent(sessionStorage, query.state);
    if (!back) return 'denied';
    markConnectCancelled(sessionStorage);
    window.location.replace(back);
    return null;
  }
  if (!query.code || !query.state || redeemed.has(query.code)) return null;
  redeemed.add(query.code);
  const returnPath = takeConsent(sessionStorage, query.state);
  if (!returnPath) {
    driveWarn('consent-state-unknown', {});
    return 'invalid';
  }
  try {
    const connection = await apiDriveConnect(ownerId, query.code, query.state);
    if (connection.pendingAccountSwitch) {
      driveLog('account-switch-asked', {});
      return { kind: 'switch', returnPath };
    }
  } catch (err) {
    driveWarn('connect-failed', { error: err instanceof Error ? err.message : String(err) });
    return 'failed';
  }
  track('Drive', 'Linked', 'Broker');
  driveLog('connected', {});
  markConnectConnected(sessionStorage);
  // Replaces this page, so Back never lands on a spent code.
  window.location.replace(returnPath);
  return null;
}

export function DriveConnected() {
  const { authLoaded, isSignedIn, clerkUserId } = useClerkApiBootstrap();
  const query = useSyncExternalStore(noSubscription, readQuery, beforeHydration);
  const [phase, setPhase] = useState<Phase>('working');

  useEffect(() => {
    if (!query || !authLoaded || !isSignedIn || !clerkUserId) return;
    void redeem(query, clerkUserId).then((next) => {
      if (next) setPhase(next);
    });
  }, [query, authLoaded, isSignedIn, clerkUserId]);

  if (authLoaded && !isSignedIn) {
    return (
      <LandingCard>
        <Heading>Sign in to connect Google Drive</Heading>
        <Body>Google Drive connects to your livediagram account.</Body>
        <PrimaryLink href="/sign-in/">Sign in</PrimaryLink>
      </LandingCard>
    );
  }
  if (typeof phase === 'object' && clerkUserId) {
    const { returnPath } = phase;
    return (
      <LandingCard>
        <Body>Connecting Google Drive…</Body>
        <DriveAccountSwitchDialog
          cloudSyncHref={CLOUD_SYNC_HREF}
          onSwitch={async () => {
            await apiConfirmDriveAccountSwitch(clerkUserId);
            track('Drive', 'Changed', 'AccountSwitched');
            driveLog('account-switched', {});
            markConnectConnected(sessionStorage);
            window.location.replace(returnPath);
          }}
          onKeep={async () => {
            await apiCancelDriveAccountSwitch(clerkUserId);
            track('Drive', 'Changed', 'AccountKept');
            driveLog('account-kept', {});
            // The connection is as it was: neither Connected nor Cancelled.
            window.location.replace(returnPath);
          }}
        />
      </LandingCard>
    );
  }
  if (phase === 'denied') {
    return (
      <LandingCard>
        <Heading>Google Drive wasn&apos;t connected</Heading>
        <Body>
          Nothing changed. You can connect it any time from Settings, Account, Cloud Sync.
        </Body>
        <PrimaryLink href={CLOUD_SYNC_HREF}>Back</PrimaryLink>
      </LandingCard>
    );
  }
  if (phase === 'invalid' || phase === 'failed') {
    return (
      <LandingCard>
        <Heading>Google Drive couldn&apos;t be connected</Heading>
        <Body>
          {phase === 'invalid'
            ? 'This connection was not started from this browser, or it took too long.'
            : 'Google did not accept the connection.'}{' '}
          Try again from Settings, Account, Cloud Sync.
        </Body>
        <PrimaryLink href={CLOUD_SYNC_HREF}>Back to Cloud Sync</PrimaryLink>
      </LandingCard>
    );
  }
  return (
    <LandingCard>
      <Body>Connecting Google Drive…</Body>
    </LandingCard>
  );
}
