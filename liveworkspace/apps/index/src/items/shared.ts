// What the item routes share (items.ts).

import type { Env } from '../env';
import { trustedClientAddress } from '@liveworkspace/sites/network';

// The address a browser's request came from: the visitor's as their app's router names it and proves
// (forwardToIndex), or the connection's own when they reached the index directly.
export const clientIpOf = (request: Request, env: Env): string | null =>
  trustedClientAddress(request, env.WORKSPACE_PROXY_SECRET) ??
  request.headers.get('CF-Connecting-IP');

export const DEFAULT_TITLE = 'Untitled';
// Emptying the Trash purges at most this many per call; the Explorer calls again while some remain.
export const EMPTY_TRASH_MAX = 1000;
