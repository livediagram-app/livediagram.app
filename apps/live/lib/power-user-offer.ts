import { readLocalStorageSafe, writeLocalStorageSafe } from './local-storage-safe';
import type { UserPreferences } from './user-preferences';

// The once-ever power user mode offer (docs/specs/007-editor/power-user-mode.md). The counts are
// device-local: they describe how THIS device is used, and syncing a
// keystroke counter would cost a preferences write per shortcut. Whether the
// offer has been made is the synced `powerUserOfferShown` latch.

export const POWER_USER_OFFER_DAYS = 20;
export const POWER_USER_OFFER_SHORTCUTS = 50;
export const OFFER_COUNTERS_KEY = 'livediagram:power-user-offer:v1';

export type OfferCounters = { days: number; lastDay: string | null; shortcuts: number };

export const EMPTY_OFFER_COUNTERS: OfferCounters = { days: 0, lastDay: null, shortcuts: 0 };

export type OfferContext = { editable: boolean; embed: boolean; zen: boolean };

// The local calendar day, so "separate days" means the reader's days.
export function localDayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function recordEditingSession(c: OfferCounters, day: string): OfferCounters {
  if (c.lastDay === day) return c;
  return { ...c, days: c.days + 1, lastDay: day };
}

export function recordShortcut(c: OfferCounters): OfferCounters {
  return { ...c, shortcuts: c.shortcuts + 1 };
}

export function offerDue(c: OfferCounters): boolean {
  return c.days >= POWER_USER_OFFER_DAYS || c.shortcuts >= POWER_USER_OFFER_SHORTCUTS;
}

export function offerEligible(prefs: UserPreferences, ctx: OfferContext): boolean {
  return (
    prefs.powerUserMode !== true &&
    prefs.powerUserOfferShown !== true &&
    // The offer is an in-editor notification; a quieter editor includes it.
    prefs.notificationsEnabled !== false &&
    ctx.editable &&
    !ctx.embed &&
    !ctx.zen
  );
}

export function parseOfferCounters(raw: string | null): OfferCounters {
  if (raw === null) return EMPTY_OFFER_COUNTERS;
  try {
    const v = JSON.parse(raw) as unknown;
    if (
      typeof v === 'object' &&
      v !== null &&
      !Array.isArray(v) &&
      typeof (v as OfferCounters).days === 'number' &&
      typeof (v as OfferCounters).shortcuts === 'number' &&
      ((v as OfferCounters).lastDay === null || typeof (v as OfferCounters).lastDay === 'string')
    ) {
      const { days, lastDay, shortcuts } = v as OfferCounters;
      return { days, lastDay, shortcuts };
    }
  } catch {
    // Falls through to the reset below.
  }
  console.warn('[power-user-offer] counters reset', raw);
  return EMPTY_OFFER_COUNTERS;
}

export function readOfferCounters(): OfferCounters {
  return parseOfferCounters(readLocalStorageSafe(OFFER_COUNTERS_KEY));
}

export function writeOfferCounters(c: OfferCounters): void {
  writeLocalStorageSafe(OFFER_COUNTERS_KEY, JSON.stringify(c));
}
