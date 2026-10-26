'use client';

// /drive/open: the Drive UI integration's Open URL for every app's files (liveworkspace/docs/drive.md "Open with").
// Google passes `state={"ids":[…],"action":"open",…}`; the service reads the file and answers: open the item in its
// app, offer Import as a copy (a copy made in Drive, a file shared with them, one from another environment), say it
// isn't ours, or offer Allow access, which connects and comes back to this same file. Signed out, they sign in first.
import { useEffect, useState } from 'react';
import { driveConnectUrl, parseDriveOpenState } from '@liveworkspace/drive/client';
import { APP_ITEMS } from '@liveworkspace/sites';
import { driveClient } from '@/lib/drive/client';
import { defaultReturn, importFailedBody, openView, type OpenView } from '@/lib/drive/pages';
import { workspaceOrigin } from '@/lib/explorer/page-app';
import {
  DriveMessage,
  DriveShell,
  DriveWorking,
  PrimaryButton,
  PrimaryLink,
  SecondaryLink,
  SignInFirst,
  useHere,
  useSignedIn,
} from './DrivePage';

type Step =
  { kind: 'opening' } | { kind: 'importing' } | { kind: 'import-failed'; body: string } | OpenView;

export function DriveOpenPage() {
  const here = useHere();
  const signedIn = useSignedIn();
  const [step, setStep] = useState<Step>({ kind: 'opening' });
  const file = here ? parseDriveOpenState(here.search) : null;
  const fileId = file?.fileId ?? null;

  useEffect(() => {
    if (signedIn !== 'in' || !fileId) return;
    let live = true;
    void driveClient.open(fileId).then((result) => {
      if (!live) return;
      const view = openView(result);
      if (view.kind === 'go') window.location.replace(view.to);
      else setStep(view);
    });
    return () => {
      live = false;
    };
  }, [signedIn, fileId]);

  const importCopy = async () => {
    if (!fileId) return;
    setStep({ kind: 'importing' });
    const result = await driveClient.importFile(fileId);
    if (result.ok) window.location.assign(result.data.url);
    else setStep({ kind: 'import-failed', body: importFailedBody(result.error) });
  };

  const explorer = `${workspaceOrigin()}/explorer`;
  const body = () => {
    if (!here) return <DriveWorking text="Opening from Google Drive…" />;
    if (!file) return <CannotOpen explorer={explorer} />;
    if (signedIn === 'out') {
      return (
        <SignInFirst
          here={here.path}
          title="Sign in to open this file"
          body="Files from Google Drive open in your liveworkspace account. We’ll bring you right back."
        />
      );
    }
    switch (step.kind) {
      case 'allow_access':
        return (
          <DriveMessage
            state="allow-access"
            title="Allow liveworkspace to read this file"
            body="Connect Google Drive once, and your files open straight from Drive."
          >
            <PrimaryLink href={driveConnectUrl(workspaceOrigin(), window.location.href)}>
              Allow access
            </PrimaryLink>
          </DriveMessage>
        );
      case 'import': {
        const noun = APP_ITEMS[step.app].noun.toLowerCase();
        return (
          <DriveMessage
            state="import"
            title={step.name}
            body={
              step.copy
                ? `This is a copy made in Google Drive. Import it as a new ${noun} to open it here; the original stays as it is.`
                : `This ${noun} isn’t in your work. Import a copy to open it here.`
            }
          >
            <PrimaryButton onClick={() => void importCopy()}>Import as a copy</PrimaryButton>
            <SecondaryLink href={explorer}>Not now</SecondaryLink>
          </DriveMessage>
        );
      }
      case 'importing':
        return <DriveWorking text="Importing…" />;
      case 'import-failed':
        return (
          <DriveMessage state="import-failed" title="The copy couldn’t be made" body={step.body}>
            <PrimaryLink href={explorer}>Go to Explorer</PrimaryLink>
          </DriveMessage>
        );
      case 'not_ours':
        return <CannotOpen explorer={explorer} />;
      case 'failed':
        return (
          <DriveMessage
            state="failed"
            title="This file couldn’t be opened just now"
            body="Couldn’t reach Google Drive. Try again in a moment."
          >
            <PrimaryButton onClick={() => window.location.reload()}>Try again</PrimaryButton>
            <SecondaryLink href={defaultReturn(workspaceOrigin())}>Cloud Sync</SecondaryLink>
          </DriveMessage>
        );
      default:
        return <DriveWorking text="Opening from Google Drive…" />;
    }
  };

  return <DriveShell>{body()}</DriveShell>;
}

function CannotOpen({ explorer }: { explorer: string }) {
  return (
    <DriveMessage
      state="not-ours"
      title="This file can’t be opened here"
      body="It isn’t a file from a liveworkspace app, or liveworkspace can’t read it."
    >
      <PrimaryLink href={explorer}>Go to Explorer</PrimaryLink>
    </DriveMessage>
  );
}
