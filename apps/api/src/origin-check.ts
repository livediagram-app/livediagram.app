// Localhost-pair detection for the telemetry endpoint's same-origin
// filter (docs/specs/017-telemetry/telemetry.md). The ingest endpoint rejects requests whose Origin
// header is present and isn't the api worker's own origin so casual
// drive-by cross-site posters can't inflate the public usage chart,
// but local dev legitimately serves two different ports (the live
// editor on :3002 / the telemetry dashboard on :3003 posting to the
// api worker on :8787), and those should be allowed through. This
// helper widens the filter to treat any localhost-to-localhost pair
// as same-origin enough for dev. Production never sees a localhost
// origin, so the widening is dev-only in practice.
//
// Lives in its own module so the rule has a test surface separate
// from the route handler: matches the precedent set by image-strip,
// image-sniff, tab-row, folder-row, share-link-row, change-log-row.

import { isLoopbackHostname } from '@livediagram/api-schema';

// IPv4 + IPv6 + textual loopback hostnames the browser may emit; the one
// definition lives in @livediagram/api-schema so the mcp agrees.
const isLoopback = isLoopbackHostname;

// True iff BOTH `origin` and `target` parse as URLs whose hostname
// is a loopback. Returns false on either side failing to parse,
// either being a non-loopback hostname, or either being empty.
export function isLocalhostPair(origin: string, target: string): boolean {
  try {
    const a = new URL(origin).hostname;
    const b = new URL(target).hostname;
    return isLoopback(a) && isLoopback(b);
  } catch {
    return false;
  }
}
