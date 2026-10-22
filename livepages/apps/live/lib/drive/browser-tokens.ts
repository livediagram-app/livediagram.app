// Where a browser tab gets its Drive access tokens: the broker (the api holds the refresh
// token) or Google's script in this browser (docs/specs/022-drive-mirror/drive-mirror.md).
// Kept apart from the engine (browser-engine.ts) because every signed-in tab needs a token
// source, while only the one tab elected to sync loads the engine.

import type { DriveMode } from '@livepages/api-schema';
import { apiDriveToken } from '../api-client';
import {
  createBrokerTokenSource,
  createBrowserTokenSource,
  type TokenSource,
} from './token-source';

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
