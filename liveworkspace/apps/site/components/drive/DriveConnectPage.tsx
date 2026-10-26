'use client';

// /drive/connect?return=<page> (liveworkspace/docs/specs/005-drive/drive.md "Connecting"): where every Connect and Reconnect, from any
// app or from liveworkspace.app, leaves for. Signed in, it asks the service for a signed consent state for the return
// page, keeps the page against it in this tab (a cancel at Google brings back the state alone), and goes to Google. It
// says Connecting… all the while, so there is never a moment where nothing seems to happen.
import { useEffect, useState } from 'react';
import { DRIVE_RETURN_PARAM } from '@liveworkspace/drive/client';
import { driveClient } from '@/lib/drive/client';
import { rememberConsent, safeReturn } from '@/lib/drive/pages';
import { appOfHost, workspaceOrigin } from '@/lib/explorer/page-app';
import {
  DriveMessage,
  DriveShell,
  DriveWorking,
  PrimaryButton,
  SecondaryLink,
  SignInFirst,
  useHere,
  useSignedIn,
} from './DrivePage';

/** liveworkspace's own pages and every app's, in this environment. */
export function isOurOrigin(url: URL): boolean {
  return (
    url.origin === workspaceOrigin() ||
    url.origin === window.location.origin ||
    appOfHost(url.host) !== null
  );
}

export function DriveConnectPage() {
  const here = useHere();
  const signedIn = useSignedIn();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const returnTo = here
    ? safeReturn(
        new URLSearchParams(here.search).get(DRIVE_RETURN_PARAM),
        workspaceOrigin(),
        isOurOrigin,
      )
    : null;

  useEffect(() => {
    if (signedIn !== 'in' || !returnTo) return;
    let live = true;
    void driveClient.state(returnTo).then((result) => {
      if (!live) return;
      if (!result.ok) {
        setFailed(true);
        return;
      }
      rememberConsent(() => sessionStorage, result.data.state, returnTo);
      window.location.assign(result.data.authUrl);
    });
    return () => {
      live = false;
    };
  }, [signedIn, returnTo, attempt]);

  return (
    <DriveShell>
      {signedIn === 'out' && here ? (
        <SignInFirst
          here={here.path}
          title="Sign in to connect Google Drive"
          body="Google Drive connects to your liveworkspace account. We’ll bring you right back."
        />
      ) : failed && returnTo ? (
        <DriveMessage
          state="failed"
          title="Google Drive couldn’t be connected"
          body="Couldn’t reach Google. Check your connection and try again."
        >
          <PrimaryButton
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </PrimaryButton>
          <SecondaryLink href={returnTo}>Back</SecondaryLink>
        </DriveMessage>
      ) : (
        <DriveWorking text="Connecting Google Drive…" />
      )}
    </DriveShell>
  );
}
