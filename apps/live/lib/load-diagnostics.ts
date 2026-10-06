// The diagnostics report a person copies from the load-error screen (docs/specs/007-editor/load-recovery.md
// "Diagnostics"). Identifiers and states only, never document content. Two credentials are kept out on
// purpose: a share code (the path's `?s=` is reported as "share link: yes") and a full guest id (an
// `X-Owner-Id` credential; only its first 8 characters go in, enough for support to find the row).

import { isClerkIdShape } from '@livediagram/api-schema';
import { formatBrowserChecks, runBrowserChecks, type BrowserChecks } from '@livediagram/ui';
import { getLoadProgress, type LoadProgress } from './load-progress';
import { getGuestSelfId, getGuestSelfSig, getPendingGuestUpgrade } from './local-identity';
import { EDITOR_BUILD_ID } from './server-release';

/** How many characters of a guest id a report carries. */
export const GUEST_ID_PREFIX_LENGTH = 8;

export type DiagnosticsInput = {
  /** The participant id the editor resolved, or null while still the placeholder. */
  ownerId: string | null;
  now: Date;
  location: Pick<Location, 'pathname' | 'search'>;
  progress: LoadProgress;
  buildId: string | null;
  checks: BrowserChecks;
  guest: { id: string | null; signed: boolean; pendingUpgrade: boolean };
};

function identityLine(input: DiagnosticsInput): string[] {
  if (input.ownerId && isClerkIdShape(input.ownerId))
    return [`Identity: signed in (${input.ownerId})`];
  const id = input.guest.id;
  return [
    `Identity: guest ${id ? `${id.slice(0, GUEST_ID_PREFIX_LENGTH)}…` : '(none yet)'}`,
    `Guest id signed: ${input.guest.signed ? 'yes' : 'no'}`,
    `Identity upgrade pending: ${input.guest.pendingUpgrade ? 'yes' : 'no'}`,
  ];
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
    ...identityLine(input),
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
    guest: {
      id: getGuestSelfId(),
      signed: getGuestSelfSig() !== null,
      pendingUpgrade: getPendingGuestUpgrade() !== null,
    },
  });
}
