'use client';

// Google Drive's row in Settings > Account > Cloud Sync (liveworkspace/docs/specs/005-drive/drive.md "Connecting"). One row: the provider on the left, its status and one
// button on the right; a second line only while something needs the person. The status keeps one width per phase
// (Layout stability). Syncing is the service's and automatic, so there is no Sync now: opening the row asks for a
// pass (`POST /api/drive/check`), and the row reads the connection again only while a pass or a first copy runs.
import { useCallback, useEffect, useRef, useState } from 'react';
import { lucideCloud, lucideTriangleAlert } from '@liveworkspace/icons/lucide';
import { Button, ConfirmDialog, lucideGlyph } from '@liveworkspace/ui';
import {
  driveConnectUrl,
  driveOutcomeOf,
  DRIVE_OUTCOME_PARAM,
  withCloudSyncOpen,
} from '@liveworkspace/drive/client';
import { SettingsRowShell } from '../SettingsRowShell';
import type { CloudSync } from './cloud-sync-host';
import {
  driveConnectedText,
  DRIVE_NOT_CONNECTED_TEXT,
  driveRowBusy,
  driveStatusOptions,
  driveSyncCopy,
  DRIVE_SINCE_STEPS_MS,
  type DriveConnectState,
  type DriveRowConnection,
  type DriveStatusText,
} from './cloud-sync-copy';

// How often the row reads the connection again while a pass or a first copy runs, and how many times it waits for a
// connection just made to show up (liveworkspace/docs/specs/005-drive/drive.md "Connecting", the row).
export const DRIVE_ROW_REFRESH_MS = 5_000;
const DRIVE_ROW_ARRIVAL_READS = 6;
// The status's "Last synced" clock.
const SINCE_TICK_MS = 30_000;

const WarningGlyph = lucideGlyph(lucideTriangleAlert, 12);
const CloudGlyph = lucideGlyph(lucideCloud, 16);

const DISCONNECT_FAILED = 'Couldn’t disconnect just now. Try again in a moment.';

// The status at the top right: plain, muted words, as wide as the widest of the phase; the warning colour and a
// glyph when something needs the person.
function StatusText({
  options,
  current,
}: {
  options: DriveStatusText[];
  current: DriveStatusText;
}) {
  const all = options.some((o) => o.text === current.text) ? options : [...options, current];
  return (
    <span data-drive-status className="grid shrink-0 text-xs tabular-nums">
      {all.map((option) => {
        const shown = option.text === current.text;
        return (
          <span
            key={option.text}
            data-warn={option.warn || undefined}
            aria-hidden={shown ? undefined : true}
            className={`inline-flex items-center gap-1 justify-self-end [grid-area:1/1] ${
              option.warn
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-slate-500 dark:text-slate-400'
            } ${shown ? '' : 'invisible'}`}
          >
            {option.warn ? <WarningGlyph /> : null}
            {option.text}
          </span>
        );
      })}
    </span>
  );
}

// "Last synced …" moves on: every 30 s, and exactly at 15 s and 60 s after a sync, where its wording changes.
function useSinceNow(lastSyncedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (lastSyncedAt === null) return;
    const tick = window.setInterval(() => setNow(Date.now()), SINCE_TICK_MS);
    const steps = DRIVE_SINCE_STEPS_MS.map((step) => {
      const wait = lastSyncedAt + step - Date.now();
      return wait > 0 ? window.setTimeout(() => setNow(Date.now()), wait) : null;
    });
    return () => {
      window.clearInterval(tick);
      steps.forEach((t) => (t === null ? undefined : window.clearTimeout(t)));
    };
  }, [lastSyncedAt]);
  return now;
}

// Back from /drive/connected: what it said, read once, and taken out of the address so a reload doesn't say it again.
function useReturnOutcome() {
  const [outcome] = useState(() =>
    typeof window === 'undefined' ? null : driveOutcomeOf(window.location.search),
  );
  useEffect(() => {
    if (!outcome) return;
    const url = new URL(window.location.href);
    url.searchParams.delete(DRIVE_OUTCOME_PARAM);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [outcome]);
  return outcome;
}

export function GoogleDriveRow({ cloudSync }: { cloudSync: CloudSync }) {
  const { client, config, workspaceOrigin, settingsParam, helpHref } = cloudSync;
  const outcome = useReturnOutcome();
  const [row, setRow] = useState<DriveRowConnection>(() =>
    config.connected || outcome === 'connected' ? { kind: 'checking' } : { kind: 'not_connected' },
  );
  const [connecting, setConnecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reads, setReads] = useState(0);

  // Only the newest read lands: an older one answering late (the opening pair, a poll) would undo a newer answer,
  // and one still on its way when Disconnect was pressed brought the connection back. Disconnecting and leaving
  // the row each start a new turn too.
  const readTurn = useRef(0);
  useEffect(
    () => () => {
      readTurn.current += 1;
    },
    [],
  );
  const read = useCallback(async () => {
    const turn = ++readTurn.current;
    const result = await client.connection();
    if (turn !== readTurn.current) return;
    setReads((n) => n + 1);
    setRow((previous) => {
      if (result.ok) {
        return result.data.connected
          ? { kind: 'connected', connection: result.data }
          : { kind: 'not_connected' };
      }
      // The last answer stays, marked unreachable; nothing known yet reads as offline.
      if (previous.kind === 'connected') return { ...previous, unreachable: true };
      return result.error === 'not_connected' ? { kind: 'not_connected' } : { kind: 'unreachable' };
    });
  }, [client]);

  // Opening the row: a pass now for someone connected (the service skips it within 30 s of the last), and the
  // connection, read again once the pass has been asked for.
  useEffect(() => {
    if (!config.connected && outcome !== 'connected') return;
    let live = true;
    void read();
    void client.check().then(() => live && void read());
    return () => {
      live = false;
    };
  }, [client, config.connected, outcome, read]);

  const connect: DriveConnectState = {
    connecting,
    connectError: null,
    cancelled: outcome === 'cancelled',
    returned: outcome === 'connected',
  };
  const keepReading =
    driveRowBusy(row, connect) && (row.kind === 'connected' || reads < DRIVE_ROW_ARRIVAL_READS);
  useEffect(() => {
    if (!keepReading) return;
    const timer = window.setTimeout(() => void read(), DRIVE_ROW_REFRESH_MS);
    return () => window.clearTimeout(timer);
  }, [keepReading, read, reads]);

  const lastSyncedAt = row.kind === 'connected' ? row.connection.lastSyncedAt : null;
  const now = useSinceNow(lastSyncedAt);
  const copy = driveSyncCopy(row, connect, now);
  const { phase } = copy;
  const problem = actionError
    ? { text: actionError, action: null, failed: true as const }
    : copy.problem;

  // Leaving for Google: this page's own history entry first names Settings on Cloud Sync, so Back from Google's page
  // (and every way back from liveworkspace's) lands here with it open.
  const startConnect = () => {
    if (connecting) return;
    setConnecting(true);
    setActionError(null);
    const back = withCloudSyncOpen(window.location.href, settingsParam);
    const url = new URL(back);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    window.location.assign(driveConnectUrl(workspaceOrigin, back));
  };

  const disconnect = async () => {
    setConfirming(false);
    setBusy(true);
    setActionError(null);
    readTurn.current += 1;
    const result = await client.disconnect();
    readTurn.current += 1;
    setBusy(false);
    if (result.ok || result.error === 'not_connected') setRow({ kind: 'not_connected' });
    else setActionError(DISCONNECT_FAILED);
  };

  const rootName = row.kind === 'connected' ? row.connection.rootFolderName : null;
  const description = phase === 'connected' ? driveConnectedText(rootName) : undefined;

  return (
    <div data-cloud-sync="googleDrive" data-drive-phase={phase}>
      <SettingsRowShell
        row={{
          key: 'googleDrive',
          label: 'Google Drive',
          description: description ?? DRIVE_NOT_CONNECTED_TEXT,
        }}
        descriptionContent={
          helpHref ? (
            <>
              {description ?? DRIVE_NOT_CONNECTED_TEXT}{' '}
              <a
                href={helpHref}
                target="_blank"
                rel="noopener"
                className="font-medium text-slate-700 underline underline-offset-2 dark:text-slate-200"
              >
                Learn more
              </a>
            </>
          ) : undefined
        }
        leading={
          <span className="flex shrink-0 text-slate-500 dark:text-slate-400">
            <CloudGlyph />
          </span>
        }
        control={
          <span
            data-drive-actions
            className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2"
          >
            <span aria-live="polite" className="text-xs">
              <StatusText options={driveStatusOptions(row, phase)} current={copy.status} />
            </span>
            {phase === 'not-connected' ? (
              <Button
                variant="primary"
                size="sm"
                // aria-disabled, not disabled: a pressed button keeps focus.
                aria-disabled={connecting || row.kind === 'checking'}
                onClick={() => {
                  if (row.kind !== 'checking') startConnect();
                }}
              >
                Connect
              </Button>
            ) : (
              <Button
                // Reversible, and the Drive files stay: a neutral action, with a neutral confirmation.
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => setConfirming(true)}
              >
                Disconnect
              </Button>
            )}
          </span>
        }
      >
        {problem ? (
          <div
            data-drive-problem
            role={problem.failed ? 'alert' : 'status'}
            className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2 dark:border-slate-700"
          >
            <p
              className={`min-w-0 text-xs ${
                problem.failed
                  ? 'text-rose-700 dark:text-rose-300'
                  : 'text-amber-800 dark:text-amber-200'
              }`}
            >
              {problem.text}
            </p>
            {problem.action === 'reconnect' ? (
              <Button variant="primary" size="sm" aria-disabled={connecting} onClick={startConnect}>
                Reconnect
              </Button>
            ) : null}
          </div>
        ) : null}
      </SettingsRowShell>
      <ConfirmDialog
        open={confirming}
        title="Disconnect Google Drive?"
        message="Your work stops syncing to Google Drive. The files already there stay where they are, and you can connect again any time."
        confirmLabel="Disconnect"
        onConfirm={() => void disconnect()}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
