// Test support for each app's metric-emitters.test.ts: the events liveworkspace's own Workers send
// in an app's name. The accounts Worker sends the onboarding series once per account, and counts each
// email under the app it speaks for (liveworkspace/apps/accounts src/telemetry.ts), so an app's
// Welcome, Week 1, Week 2, Activation and Win-Back charts are fed from there as well as, or instead
// of, the app's own api. Its team invitations, reminders and answers likewise feed the Team Invites,
// Invite Reminders and Invite Responses charts, under the app the inviter signed up through, and its
// expiring-token warnings the Token Expiry Warnings chart, under the app the token's owner signed up
// through. Each app's scan covers only its own folder, so it adds these.

import { resolve } from 'node:path';
import { scanEmitters, type Emit } from './livediagram/emitter-scan';

const MONOREPO = resolve(__dirname, '../../../../..');

// The platform Workers that report in an app's name.
export const PLATFORM_ROOTS = ['liveworkspace/apps/accounts/src'];

let cached: Emit[] | undefined;

// Every emit in the platform Workers, with paths from the monorepo root.
export function platformEmitters(): Emit[] {
  cached ??= scanEmitters(MONOREPO, PLATFORM_ROOTS, '');
  return cached;
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
