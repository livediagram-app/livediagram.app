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

// The unseen-folder notice on one diagram, if any.
export function useDriveNotice(diagramId: string): DriveMirrorNotice | null {
  const { status } = useDriveMirror();
  return status.notices.find((n) => n.kind === 'diagram' && n.ldId === diagramId) ?? null;
}
