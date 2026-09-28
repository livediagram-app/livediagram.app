'use client';

// /drive/open: the Drive UI integration's Open URL
// (docs/specs/022-drive-mirror/drive-mirror.md, "Open with"). Google passes
// `state`; this reads the file and opens the diagram, offers **Import a copy**,
// or says the file cannot be opened.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Button } from '@livediagram/ui';
import { ApiError, apiDriveToken } from '@/lib/api-client';
import { useClerkApiBootstrap } from '@/hooks/persistence/useClerkApiBootstrap';
import { googleClientId } from '@/lib/drive/config';
import { createDriveRestClient } from '@/lib/drive/drive-rest-client';
import { requestBrowserAccessToken } from '@/lib/drive/google-scripts';
import { createApiLivediagramPort } from '@/lib/drive/livediagram-port';
import { driveWarn } from '@/lib/drive/log';
import {
  importOpenWithCopy,
  openWithTelemetryType,
  parseOpenState,
  resolveOpenWith,
  type OpenWithOutcome,
  type OpenWithState,
} from '@/lib/drive/open-with';
import { track } from '@/lib/telemetry';
import { Body, Heading, LandingCard, PrimaryLink } from '@/components/chrome/LandingCard';
import { useDriveMirror } from './drive-mirror-context';

const noSubscription = () => () => {};
let cachedSearch = '';
let cachedState: OpenWithState | null = null;
const readState = (): OpenWithState | null => {
  if (window.location.search !== cachedSearch) {
    cachedSearch = window.location.search;
    cachedState = parseOpenState(cachedSearch);
  }
  return cachedState;
};
const beforeHydration = (): OpenWithState | null | undefined => undefined;

type Phase =
  | { kind: 'loading' }
  | { kind: 'needs-access' }
  | { kind: 'outcome'; outcome: OpenWithOutcome }
  | { kind: 'importing' }
  | { kind: 'import-failed' };

export function DriveOpen() {
  const { authLoaded, isSignedIn, clerkUserId } = useClerkApiBootstrap();
  const drive = useDriveMirror();
  const state = useSyncExternalStore(noSubscription, readState, beforeHydration);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [token, setToken] = useState<string | null>(null);

  // A token: the broker's, or a click away in browser-only mode.
  useEffect(() => {
    if (!clerkUserId || drive.mode !== 'broker' || token) return;
    let live = true;
    void apiDriveToken(clerkUserId)
      .then((t) => live && setToken(t.accessToken))
      .catch((err: unknown) => {
        if (!live) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 409)) {
          setPhase({ kind: 'needs-access' });
        } else setPhase({ kind: 'outcome', outcome: { kind: 'error', reason: 'unreadable' } });
      });
    return () => {
      live = false;
    };
  }, [clerkUserId, drive.mode, token]);

  const client = useCallback(
    (accessToken: string) =>
      createDriveRestClient({
        fetch: (i, init) => fetch(i, init),
        getAccessToken: async () => accessToken,
      }),
    [],
  );

  useEffect(() => {
    if (!token || !state || !clerkUserId) return;
    let live = true;
    void resolveOpenWith(
      {
        drive: client(token),
        port: createApiLivediagramPort(clerkUserId),
        host: window.location.host,
      },
      state,
    )
      .then((outcome) => {
        if (!live) return;
        track('Drive', 'Opened', openWithTelemetryType(outcome));
        if (outcome.kind === 'open')
          window.location.assign(`/diagram/${encodeURIComponent(outcome.diagramId)}`);
        else setPhase({ kind: 'outcome', outcome });
      })
      .catch((err: unknown) => {
        driveWarn('open-with-failed', { error: err instanceof Error ? err.message : String(err) });
        if (live) setPhase({ kind: 'outcome', outcome: { kind: 'error', reason: 'unreadable' } });
      });
    return () => {
      live = false;
    };
  }, [token, state, clerkUserId, client]);

  const allowAccess = async () => {
    if (drive.mode === 'browser') {
      setToken((await requestBrowserAccessToken(googleClientId, () => Date.now(), '')).accessToken);
      return;
    }
    await drive.connect();
  };

  const importCopy = async () => {
    if (!token || !state || !clerkUserId) return;
    setPhase({ kind: 'importing' });
    try {
      const id = await importOpenWithCopy(
        { drive: client(token), port: createApiLivediagramPort(clerkUserId) },
        state,
      );
      window.location.assign(`/diagram/${encodeURIComponent(id)}`);
    } catch (err) {
      driveWarn('open-with-import-failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      setPhase({ kind: 'import-failed' });
    }
  };

  if (authLoaded && !isSignedIn) {
    const back = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    return (
      <LandingCard>
        <Heading>Sign in to open this diagram</Heading>
        <Body>
          Files from Google Drive open in your livediagram account. We&apos;ll bring you right back.
        </Body>
        <PrimaryLink href={`/sign-in/?redirect_url=${back}`}>Sign in</PrimaryLink>
      </LandingCard>
    );
  }
  if (
    state === null ||
    (authLoaded && isSignedIn && drive.mode === 'off' && drive.status.state !== 'starting')
  ) {
    return <CannotOpen />;
  }
  if (phase.kind === 'needs-access') {
    return (
      <LandingCard>
        <Heading>Allow livediagram to read this file</Heading>
        <Body>Connect Google Drive once, and files open straight from Drive.</Body>
        <div className="mt-5 flex justify-center">
          <Button size="md" onClick={() => void allowAccess()}>
            Allow access
          </Button>
        </div>
      </LandingCard>
    );
  }
  if (phase.kind === 'outcome' && phase.outcome.kind === 'error') return <CannotOpen />;
  if (phase.kind === 'outcome' && phase.outcome.kind === 'import') {
    return (
      <LandingCard>
        <Heading>{phase.outcome.name}</Heading>
        <Body>This diagram isn&apos;t in your livediagram. Import a copy to open it here.</Body>
        <div className="mt-5 flex justify-center">
          <Button size="md" onClick={() => void importCopy()}>
            Import a copy
          </Button>
        </div>
      </LandingCard>
    );
  }
  if (phase.kind === 'import-failed') {
    return (
      <LandingCard>
        <Heading>The copy couldn&apos;t be made</Heading>
        <Body>The file isn&apos;t a readable livediagram diagram.</Body>
        <PrimaryLink href="/explorer">Go to Explorer</PrimaryLink>
      </LandingCard>
    );
  }
  return (
    <LandingCard>
      <Body>{phase.kind === 'importing' ? 'Importing a copy…' : 'Opening from Google Drive…'}</Body>
    </LandingCard>
  );
}

function CannotOpen() {
  return (
    <LandingCard>
      <Heading>This file can&apos;t be opened in livediagram</Heading>
      <Body>It isn&apos;t a livediagram file, or livediagram can&apos;t read it.</Body>
      <PrimaryLink href="/explorer">Go to Explorer</PrimaryLink>
    </LandingCard>
  );
}
