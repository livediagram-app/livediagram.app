// Where each of the person's items stands with Google Drive, for the Explorer's marks (liveworkspace/docs/specs/005-drive/drive.md
// "The Explorer shows each item's sync"). The config answer says first whether the person is connected; only then are
// the marks (and the connection, for the reconnect banner) asked for, so someone who never connected costs one cheap
// read per Explorer and nothing more. Read once per mount and again when the window regains focus, at most every
// DRIVE_MARKS_MIN_GAP_MS; there is no polling loop.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DriveClient } from '@liveworkspace/drive/client';
import type { DriveMarksAnswer } from '@liveworkspace/drive';

/** The Drive service's calls the Explorer makes: a Drive client (createDriveClient) over the host's own origin. */
export type DriveMarksClient = Pick<DriveClient, 'config' | 'marks' | 'connection'>;

/** What a host hands the Explorer for Drive: the client, and liveworkspace's origin for the banner's Reconnect. */
export type ExplorerDriveHost = { client: DriveMarksClient; workspaceOrigin: string };

export type DriveMark = DriveMarksAnswer['marks'][number];

export type DriveMarks = {
  // By item or folder id; empty for someone not connected.
  byId: ReadonlyMap<string, DriveMark>;
  // Google refused the stored grant: the banner offers Reconnect.
  needsReconnect: boolean;
};

// A focus within this long of the last read reads nothing.
export const DRIVE_MARKS_MIN_GAP_MS = 30_000;

const NONE: DriveMarks = { byId: new Map(), needsReconnect: false };

export function useDriveMarks(
  host: ExplorerDriveHost | null | undefined,
  now: () => number = Date.now,
): DriveMarks {
  const [marks, setMarks] = useState<DriveMarks>(NONE);
  const client = host?.client ?? null;
  // The clock is the caller's (a test's); read through a ref so a fresh function each render changes nothing.
  const clock = useRef(now);
  clock.current = now;

  useEffect(() => {
    if (!client) return;
    let live = true;
    let connected: boolean | null = null;
    let lastRead = -Infinity;
    let reading = false;

    const read = async () => {
      if (reading) return;
      reading = true;
      lastRead = clock.current();
      try {
        if (connected === null) {
          const config = await client.config();
          connected = config.ok && config.data.enabled && config.data.connected;
        }
        if (!connected) return;
        const [answer, connection] = await Promise.all([client.marks(), client.connection()]);
        if (!live) return;
        setMarks((previous) => ({
          byId: answer.ok ? new Map(answer.data.marks.map((m) => [m.id, m])) : previous.byId,
          needsReconnect: connection.ok
            ? connection.data.connected && connection.data.status === 'needs_reconnect'
            : previous.needsReconnect,
        }));
      } finally {
        reading = false;
      }
    };

    void read();
    const onFocus = () => {
      // Someone not connected was answered once; a connection made elsewhere shows on the next visit.
      if (connected === false) return;
      if (clock.current() - lastRead < DRIVE_MARKS_MIN_GAP_MS) return;
      void read();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      live = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [client]);

  return useMemo(() => (client ? marks : NONE), [client, marks]);
}
