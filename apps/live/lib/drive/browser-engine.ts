// The engine as a browser tab runs it: real fetch, timers, localStorage,
// document visibility and the canvas rasteriser, with telemetry mapped onto
// the closed `Drive` enums (docs/specs/022-drive-mirror/drive-mirror.md, "Telemetry").

import type { DriveMode } from '@livediagram/api-schema';
import { apiDriveToken } from '../api-client';
import { track } from '../telemetry';
import { createDriveRestClient } from './drive-rest-client';
import { DriveMirrorEngine, type DriveMirrorStatus } from './engine';
import { createApiLivediagramPort } from './livediagram-port';
import { rasteriseSvgToPng } from './thumbnail';
import { localSeenStore } from './tombstones';
import {
  createBrokerTokenSource,
  createBrowserTokenSource,
  type TokenSource,
} from './token-source';

const DEVICE_KEY = 'livediagram:v2:drive-device';
const FIRST_MIRROR_KEY = 'livediagram:v2:drive-first-mirror';
export const DIAGNOSTICS_KEY = 'livediagram:v2:drive-diagnostics';

// A random per-browser id: the lease holder (D13).
export function driveDeviceId(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): string {
  let id = storage.getItem(DEVICE_KEY);
  if (!id || !/^[A-Za-z0-9-]{1,64}$/.test(id)) {
    id = crypto.randomUUID();
    storage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export type BrowserTokens =
  | { mode: 'broker'; source: TokenSource & { clear(): void } }
  | { mode: 'browser'; source: ReturnType<typeof createBrowserTokenSource> };

export function createBrowserTokens(
  mode: Exclude<DriveMode, 'off'>,
  ownerId: string,
): BrowserTokens {
  const now = () => Date.now();
  return mode === 'broker'
    ? { mode, source: createBrokerTokenSource({ fetchToken: () => apiDriveToken(ownerId), now }) }
    : { mode, source: createBrowserTokenSource({ now }) };
}

export function createBrowserEngine(input: {
  ownerId: string;
  tokens: TokenSource;
  onStatus: (status: DriveMirrorStatus) => void;
  onInboundApplied: () => void;
}): DriveMirrorEngine {
  return new DriveMirrorEngine({
    ownerId: input.ownerId,
    host: window.location.host,
    deviceId: driveDeviceId(),
    port: createApiLivediagramPort(input.ownerId),
    drive: createDriveRestClient({
      fetch: (i, init) => fetch(i, init),
      getAccessToken: (opts) => input.tokens.get(opts),
    }),
    tokens: input.tokens,
    rasterise: rasteriseSvgToPng,
    seen: localSeenStore(localStorage),
    now: () => Date.now(),
    timers: {
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      clearTimeout: (handle) => window.clearTimeout(handle as number),
    },
    track: (action, type) => {
      if (action === 'Applied' && type) track('Drive', 'Applied', type);
      else if (action === 'FirstMirrorFinished') track('Drive', 'Created', 'FirstMirror');
      else if (action === 'ReconnectNeeded') track('Drive', 'Changed', 'NeedsReconnect');
    },
    firstMirror: {
      done: (at) => localStorage.getItem(FIRST_MIRROR_KEY) === String(at),
      mark: (at) => localStorage.setItem(FIRST_MIRROR_KEY, String(at)),
    },
    isVisible: () => document.visibilityState === 'visible',
    onStatus: input.onStatus,
    onInboundApplied: input.onInboundApplied,
    // The E-A3 diagnostic (docs/specs/022-drive-mirror/drive-mirror.md, "Cadence"): opt-in.
    diagnostics: () => localStorage.getItem(DIAGNOSTICS_KEY) === '1',
  });
}
