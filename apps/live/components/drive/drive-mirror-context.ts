'use client';

// What the Drive mirror offers the UI (docs/specs/022-drive-mirror/drive-mirror.md,
// "Connecting"): the deployment's mode, the elected tab's status, and the
// panel's actions. Every tab has it; only the elected tab runs the engine.

import { createContext, useContext } from 'react';
import type { DriveMode } from '@livediagram/api-schema';
import type { DriveMirrorNotice, DriveMirrorStatus } from '@/lib/drive/engine';

export type DriveMirrorContextValue = {
  // 'off' hides every Drive surface.
  mode: DriveMode;
  // Whether `mode` is settled (auth and the capabilities answer are in).
  resolved: boolean;
  status: DriveMirrorStatus;
  // Whether "Show this folder to livediagram" can be offered (a Picker key).
  canAdopt: boolean;
  // Connect pressed and the page not yet gone to Google; and why the last
  // attempt could not start, if it could not.
  connecting: boolean;
  connectError: string | null;
  // The user came back from cancelling at Google.
  connectNote: 'cancelled' | null;
  // A check the Cloud Sync row asked for is running.
  checking: boolean;
  // The Cloud Sync row came into view: check, unless one ran moments ago.
  requestCheck(): void;
  connect(): Promise<void>;
  resume(): Promise<void>;
  disconnect(): Promise<void>;
  adopt(notice: DriveMirrorNotice): Promise<void>;
};

export const DRIVE_STATUS_INITIAL: DriveMirrorStatus = {
  state: 'starting',
  lastSyncedAt: null,
  progress: null,
  error: null,
  leaseHeldElsewhere: false,
  notices: [],
  rootName: null,
  rootFolderId: null,
  mirrored: null,
  failed: [],
};

const noop = async () => {};

export const DRIVE_MIRROR_OFF: DriveMirrorContextValue = {
  mode: 'off',
  resolved: true,
  status: DRIVE_STATUS_INITIAL,
  canAdopt: false,
  connecting: false,
  connectError: null,
  connectNote: null,
  checking: false,
  requestCheck: () => {},
  connect: noop,
  resume: noop,
  disconnect: noop,
  adopt: noop,
};

export const DriveMirrorContext = createContext<DriveMirrorContextValue>(DRIVE_MIRROR_OFF);

export function useDriveMirror(): DriveMirrorContextValue {
  return useContext(DriveMirrorContext);
}

// Where one document stands with Google Drive, for its Explorer row
// (docs/specs/022-drive-mirror/drive-mirror.md, "The Explorer shows each document's sync").
// `mirrorable`: the row's own knowledge that the document belongs in Drive
// (it is the user's, in My documents, not offline), so a document the
// engine has not seen yet (new, duplicated, imported, moved out of a team)
// shows Waiting at once instead of nothing. Null: nothing to say (Drive not
// connected, the first read of drive_items not back yet, not mirrored, or a
// folder notice on the row instead).
export type DocumentSyncState = 'synced' | 'waiting' | 'syncing' | 'failed';

export function documentSyncState(
  status: DriveMirrorStatus,
  documentId: string,
  savedAt: number,
  mirrorable: boolean,
): DocumentSyncState | null {
  // Starting or disconnected: nothing to say. Paused (reconnect or resume):
  // still known which documents are up to date and which are not.
  if (status.state === 'starting' || status.state === 'disconnected') return null;
  if (status.mirrored === null) return null;
  if (!mirrorable) return null;
  if (status.notices.some((n) => n.kind === 'document' && n.ldId === documentId)) return null;
  if (status.failed.includes(documentId)) return 'failed';
  const uploaded = status.mirrored[documentId] ?? null;
  if (uploaded !== null && uploaded >= savedAt) return 'synced';
  return status.state === 'syncing' ? 'syncing' : 'waiting';
}

export function useDocumentSync(
  documentId: string,
  savedAt: number,
  mirrorable: boolean,
): DocumentSyncState | null {
  const { status } = useDriveMirror();
  return documentSyncState(status, documentId, savedAt, mirrorable);
}

// The unseen-folder notice on one document, if any.
export function useDriveNotice(documentId: string): DriveMirrorNotice | null {
  const { status } = useDriveMirror();
  return status.notices.find((n) => n.kind === 'document' && n.ldId === documentId) ?? null;
}
