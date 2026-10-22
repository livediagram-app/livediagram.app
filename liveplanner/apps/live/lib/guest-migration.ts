import { apiMigrateGuestData } from './api-client';
import {
  clearGuestSelfId,
  getGuestSelfId,
  getGuestSelfSig,
  subscribeGuestSelfId,
} from './local-identity';
import { debugLog } from '@/lib/debug-log';
import { createListeners } from '@/lib/listeners';

// Guest → account migration (docs/specs/014-identity/auth-and-guest-access.md).
// Owner data waits for it: until it settles, the guest's projects still
// belong to the guest id, and a read as the account id 404s. One run per
// page load, shared by every component that mounts useAccountBootstrap.

// How long a pending migration may hold the page before it lets go.
// Above a slow D1 write (~1-2 s); below the point a blank editor reads as broken.
export const GUEST_MIGRATION_WAIT_MS = 10_000;

let inFlight: { accountUserId: string; settled: Promise<void> } | null = null;
const settledFor = new Set<string>();

// The pending state as an external store (docs/specs/003-system-architecture/react-state-and-effects.md):
// components read it with useSyncExternalStore, and settling notifies them. A forced re-render
// is not enough: the React Compiler memoises `guestMigrationPending(accountUserId)` on its
// argument, so a re-render with the same user kept the stale "pending" and the editor never
// loaded the project. The guest id is part of the state, so its changes notify too.
const listeners = createListeners();
export function subscribeGuestMigration(onChange: () => void): () => void {
  const unsubscribe = listeners.subscribe(onChange);
  const unsubscribeGuestId = subscribeGuestSelfId(onChange);
  return () => {
    unsubscribe();
    unsubscribeGuestId();
  };
}

function needsMigration(accountUserId: string): boolean {
  const guestId = getGuestSelfId();
  return !!guestId && guestId !== accountUserId;
}

export function guestMigrationPending(accountUserId: string): boolean {
  return !settledFor.has(accountUserId) && needsMigration(accountUserId);
}

export function settleGuestMigration(accountUserId: string): Promise<void> {
  if (!guestMigrationPending(accountUserId)) return Promise.resolve();
  if (inFlight?.accountUserId === accountUserId) return inFlight.settled;

  const guestId = getGuestSelfId()!;
  const migrated = apiMigrateGuestData(guestId, getGuestSelfSig()).then(
    (res) => {
      if (res) {
        clearGuestSelfId();
        debugLog('[guest-migration] moved guest data into the account', res);
      } else {
        console.warn('[guest-migration] refused; the guest id stays for the next load');
      }
    },
    (err: unknown) => {
      console.warn('[guest-migration] failed; the guest id stays for the next load', err);
    },
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      console.warn(
        `[guest-migration] still pending after ${GUEST_MIGRATION_WAIT_MS} ms; loading anyway`,
      );
      resolve();
    }, GUEST_MIGRATION_WAIT_MS);
  });
  const settled = Promise.race([migrated, budget]).then(() => {
    clearTimeout(timer);
    settledFor.add(accountUserId);
    inFlight = null;
    listeners.notify();
  });
  inFlight = { accountUserId, settled };
  return settled;
}

export function resetGuestMigrationForTests(): void {
  inFlight = null;
  settledFor.clear();
}
