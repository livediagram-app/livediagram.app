// The diagnostics report a person copies from the load-error screen (docs/specs/007-editor/load-recovery.md
// "Diagnostics"). Identifiers and states only, never document content. Two credentials are kept out on
// purpose: a share code (the path's `?s=` is reported as "share link: yes") and a full guest id (an
// `X-Owner-Id` credential; @livediagram/ui's identity lines carry only its first 8 characters).

import { isClerkIdShape } from '@livediagram/api-schema';
import {
  formatBrowserChecks,
  formatBrowserIdentity,
  readBrowserIdentity,
  runBrowserChecks,
  type BrowserChecks,
  type BrowserIdentity,
} from '@livediagram/ui';
import { getLoadProgress, type LoadProgress } from './load-progress';
import { EDITOR_BUILD_ID } from './server-release';

export type DiagnosticsInput = {
  /** The participant id the editor resolved, or null while still the placeholder. */
  ownerId: string | null;
  now: Date;
  location: Pick<Location, 'pathname' | 'search'>;
  progress: LoadProgress;
  buildId: string | null;
  checks: BrowserChecks;
  identity: BrowserIdentity;
};

// The shared identity lines, with the account the editor resolved: a Clerk-shaped owner id is the
// signed-in account (not a credential on its own), anything else is the guest the lines already cover.
function identityLines(input: DiagnosticsInput): string[] {
  const account = input.ownerId && isClerkIdShape(input.ownerId) ? input.ownerId : null;
  return formatBrowserIdentity(input.identity, account);
}

function loadLines(p: LoadProgress, now: Date): string[] {
  const ranFor =
    p.startedAt === null ? 'not started' : `${((now.getTime() - p.startedAt) / 1000).toFixed(1)}s`;
  return [
    `Load step: ${p.step ?? 'not started'}`,
    `Load running for: ${ranFor}`,
    `Load timed out: ${p.timedOut ? 'yes' : 'no'}`,
  ];
}

/** The report text, from everything already gathered. Pure, for the tests. */
export function formatDiagnostics(input: DiagnosticsInput): string {
  const share = new URLSearchParams(input.location.search).has('s');
  return [
    'livediagram diagnostics',
    `Time: ${input.now.toISOString()}`,
    `Page: ${input.location.pathname}${share ? ' (share link: yes)' : ''}`,
    `Build: ${input.buildId ?? 'unknown'}`,
    ...identityLines(input),
    ...loadLines(input.progress, input.now),
    ...formatBrowserChecks(input.checks),
  ].join('\n');
}

/** Gather and format the report, on press. */
export async function buildLoadDiagnostics(ownerId: string | null): Promise<string> {
  return formatDiagnostics({
    ownerId,
    now: new Date(),
    location: window.location,
    progress: getLoadProgress(),
    buildId: EDITOR_BUILD_ID,
    checks: await runBrowserChecks(),
    identity: readBrowserIdentity(),
  });
}
