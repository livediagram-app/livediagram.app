// Test support for each app's metric-emitters.test.ts: the events liveworkspace sends in an app's
// name. Each app's scan covers only its own folder, so it adds these.
//
// - The accounts Worker sends the onboarding series once per account, and counts each email under the
//   app it speaks for (liveworkspace/apps/accounts src/telemetry.ts), so an app's Welcome, Week 1,
//   Week 2, Activation and Win-Back charts are fed from there as well as, or instead of, the app's own
//   api. Its team invitations, reminders and answers likewise feed the Team Invites, Invite Reminders
//   and Invite Responses charts, under the app the inviter signed up through, and its expiring-token
//   warnings the Token Expiry Warnings chart, under the app the token's owner signed up through.
// - The Explorer on liveworkspace.app (apps/site/lib/explorer/telemetry.ts) reports in the name of the
//   app it is filtered to: the Timeline, Home, the lens, the Inbox, the view toggle, the Share dialog
//   and the guest's banner, the events each app's own Explorer always sent. Its types are the
//   Explorer's closed list (@liveworkspace/telemetry EXPLORER_TELEMETRY_EVENTS), declared here once
//   as computed values for every app's checks.
//
// An app sees only the events its own vocabulary takes (the service stores nothing else for it), so a
// revoked pass counts as liveplanner's Project·Removed and as the others' Document·Removed.

import { resolve } from 'node:path';
import { EXPLORER_TELEMETRY_EVENTS, type TelemetryWireEvent } from '@liveworkspace/telemetry';
import { COMPUTED, scanEmitters, type Emit } from './emitter-scan';

const MONOREPO = resolve(__dirname, '../../../../..');

// The platform code that reports in an app's name.
export const PLATFORM_ROOTS = [
  'liveworkspace/apps/accounts/src',
  'liveworkspace/apps/site/lib/explorer',
];

// The Explorer's emitter on liveworkspace.app.
export const EXPLORER_EMITTER = 'liveworkspace/apps/site/lib/explorer/telemetry.ts';

type Vocabulary = (event: TelemetryWireEvent) => boolean;

let cached: Emit[] | undefined;

function allPlatformEmitters(): Emit[] {
  cached ??= scanEmitters(MONOREPO, PLATFORM_ROOTS, '');
  return cached;
}

// Whether an app's vocabulary takes an emit's category and action (its type is checked by the scan's
// own rules, and may be computed).
const takes = (vocabulary: Vocabulary | undefined, e: Emit) =>
  !vocabulary ||
  (typeof e.category === 'string' &&
    typeof e.action === 'string' &&
    vocabulary({ category: e.category, action: e.action, type: null }));

// Every emit in the platform code that the app's vocabulary takes, with paths from the monorepo root.
export function platformEmitters(vocabulary?: Vocabulary): Emit[] {
  return allPlatformEmitters().filter((e) => takes(vocabulary, e));
}

// The values each of the Explorer's computed emit sites can send, by the scan's site key
// (`<path> <Category>·<Action>`), for the app's computed-emitters.ts: the Explorer's closed list.
export function platformComputedEmitters(
  vocabulary?: Vocabulary,
): Record<string, { values: readonly (string | null)[] }> {
  const out: Record<string, { values: readonly (string | null)[] }> = {};
  for (const e of platformEmitters(vocabulary)) {
    if (e.type !== COMPUTED || e.path !== EXPLORER_EMITTER) continue;
    const key = `${String(e.category)}·${String(e.action)}`;
    const values = (EXPLORER_TELEMETRY_EVENTS as Record<string, readonly (string | null)[]>)[key];
    if (values) out[`${e.path} ${key}`] = { values };
  }
  return out;
}

// The email kinds the platform Workers count on `Email·Sent`, so an app's Emails Sent stack charts
// them beside its own api's templates.
export function platformEmailKinds(): string[] {
  const kinds = platformEmitters()
    .filter((e) => e.category === 'Email' && e.action === 'Sent')
    .map((e) => e.type)
    .filter((type): type is string => typeof type === 'string');
  return [...new Set(kinds)].sort();
}
