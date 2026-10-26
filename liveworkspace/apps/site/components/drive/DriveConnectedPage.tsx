'use client';

// /drive/connected: Google's redirect URI (liveworkspace/docs/drive.md "Connecting"). The code and the state go to the
// service, which checks the state, redeems the code and keeps the sealed refresh token; then the browser goes back to
// the page the connect started from, with Settings open on Cloud Sync. A cancel at Google comes back the same way,
// calmly. A consent from another Google account than the one Cloud Sync uses asks first (Switch Google Account?).
import { useEffect, useState } from 'react';
import { withDriveOutcome } from '@liveworkspace/drive/client';
import { driveClient } from '@/lib/drive/client';
import {
  connectedQuery,
  connectedView,
  defaultReturn,
  planConnected,
  takeConsent,
  type ConnectedView,
} from '@/lib/drive/pages';
import { workspaceOrigin } from '@/lib/explorer/page-app';
import {
  DriveMessage,
  DriveShell,
  DriveWorking,
  PrimaryLink,
  SignInFirst,
  useHere,
  useSignedIn,
} from './DrivePage';
import { DriveSwitchDialog } from './DriveSwitchDialog';

// A code redeems once; React may run an effect twice in development.
const redeemed = new Set<string>();

type Step = { kind: 'working' } | ConnectedView;

const FAILED_BODY: Record<Extract<ConnectedView, { kind: 'failed' }>['reason'], string> = {
  invalid_state:
    'This connection wasn’t started here, or it took too long. Connect again from Cloud Sync.',
  no_refresh_token: 'Google didn’t give lasting access. Connect again from Cloud Sync.',
  refused: 'Google didn’t accept the connection. Try again from Cloud Sync.',
  offline:
    'Couldn’t reach liveworkspace. Check your connection, then connect again from Cloud Sync.',
};

export function DriveConnectedPage() {
  const here = useHere();
  const signedIn = useSignedIn();
  const [step, setStep] = useState<Step>({ kind: 'working' });

  useEffect(() => {
    if (!here) return;
    const query = connectedQuery(here.search);
    // A cancel needs no one signed in: nothing is redeemed.
    if (!query.error && signedIn !== 'in') return;
    const origin = workspaceOrigin();
    const remembered = takeConsent(() => sessionStorage, query.state);
    const plan = planConnected(query, remembered, origin);
    if (plan.kind === 'leave') {
      // Replaces this page, so Back never lands on a spent code.
      window.location.replace(plan.to);
      return;
    }
    // Nothing to redeem: drawn from the address below.
    if (plan.kind === 'invalid') return;
    if (redeemed.has(plan.code)) return;
    redeemed.add(plan.code);
    void driveClient.connect(plan.code, plan.state).then((result) => {
      const view = connectedView(result, remembered ?? defaultReturn(origin));
      if (view.kind === 'leave') window.location.replace(view.to);
      else setStep(view);
    });
    // Read once: the address and who is here, as the page opens.
  }, [here, signedIn]);

  const explorer = defaultReturn(workspaceOrigin());
  const query = here ? connectedQuery(here.search) : null;
  // An address with neither a cancel nor a code and its state.
  const invalid = query !== null && !query.error && (!query.code || !query.state);
  return (
    <DriveShell>
      {invalid ? (
        <DriveMessage
          state="invalid"
          title="Nothing to connect here"
          body="This address doesn’t carry a Google Drive connection. Connect from Settings, Account, Cloud Sync."
        >
          <PrimaryLink href={explorer}>Go to Cloud Sync</PrimaryLink>
        </DriveMessage>
      ) : signedIn === 'out' && here && !query?.error ? (
        <SignInFirst
          here={here.path}
          title="Sign in to connect Google Drive"
          body="Google Drive connects to your liveworkspace account. We’ll bring you right back."
        />
      ) : step.kind === 'failed' ? (
        <DriveMessage
          state="failed"
          title="Google Drive couldn’t be connected"
          body={FAILED_BODY[step.reason]}
        >
          <PrimaryLink href={step.returnTo}>Back to Cloud Sync</PrimaryLink>
        </DriveMessage>
      ) : step.kind === 'switch' ? (
        <>
          <DriveWorking text="Connecting Google Drive…" />
          <DriveSwitchDialog
            client={driveClient}
            onSwitched={() => window.location.replace(withDriveOutcome(step.returnTo, 'connected'))}
            // The connection is as it was: neither connected nor cancelled.
            onKept={() => window.location.replace(step.returnTo)}
            cloudSyncHref={step.returnTo}
          />
        </>
      ) : (
        <DriveWorking text="Connecting Google Drive…" />
      )}
    </DriveShell>
  );
}
