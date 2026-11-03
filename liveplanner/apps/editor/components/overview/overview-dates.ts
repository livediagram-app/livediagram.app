// The Overview header's dates line (docs/specs/026-plan/plan-overview.md "Header"): "Created by Ana on 14 Oct ·
// Edited 8 mins ago". Pure; `now` comes from the shared relative-time clock.
import { formatRelativeTime } from '@/lib/relative-time';

// "14 Oct" in this year, "14 Oct 2025" in any other.
export function shortDate(at: number, now: number, locale?: string): string {
  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return new Date(at).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

// The parts the line holds, either left out when unknown; null when neither is known.
export function datesLine(input: {
  createdAt: number;
  ownerName: string | null;
  editedAt: number;
  now: number;
  locale?: string;
}): string | null {
  const { createdAt, ownerName, editedAt, now, locale } = input;
  const parts: string[] = [];
  if (createdAt > 0) {
    const on = shortDate(createdAt, now, locale);
    parts.push(ownerName ? `Created by ${ownerName} on ${on}` : `Created on ${on}`);
  }
  if (editedAt > 0) parts.push(`Edited ${formatRelativeTime(Math.max(0, now - editedAt))}`);
  return parts.length ? parts.join(' · ') : null;
}
