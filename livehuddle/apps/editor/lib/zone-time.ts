// A time zone's wall time for the World Clock (docs/specs/009-elements/social-pieces.md "World Clock"), shared by
// its face on the canvas and its reader (docs/specs/008-canvas/avatar-mode.md "The reader"), and the zone an Editor
// types into its menu.
import { isClockZone, zoneCityLabel, type ClockZone } from '@livehuddle/document';

const timeFormats = new Map<string, Intl.DateTimeFormat | null>();
const partFormats = new Map<string, Intl.DateTimeFormat | null>();

// A zone's formatter, or null for a zone this browser does not know. Kept per zone: a clock re-renders once a minute.
function formatFor(
  cache: Map<string, Intl.DateTimeFormat | null>,
  zone: string | undefined,
  opts: Intl.DateTimeFormatOptions,
) {
  const key = zone ?? '';
  if (!cache.has(key)) {
    try {
      cache.set(
        key,
        new Intl.DateTimeFormat(undefined, { ...opts, ...(zone ? { timeZone: zone } : {}) }),
      );
    } catch {
      cache.set(key, null);
    }
  }
  return cache.get(key) ?? null;
}

/** A zone's wall time at `at`: hours and minutes for the hands, the time as the viewer's locale writes it, and the
 *  day against the viewer's own. Null for a zone the browser does not know. */
export function zoneTime(
  zone: string | undefined,
  at: number,
): { hour: number; minute: number; text: string; dayShift: number } | null {
  const parts = formatFor(partFormats, zone, {
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hourCycle: 'h23',
  });
  const text = formatFor(timeFormats, zone, { hour: 'numeric', minute: '2-digit' });
  if (!parts || !text) return null;
  const get = (p: Intl.DateTimeFormatPart[], type: string) =>
    Number(p.find((x) => x.type === type)?.value ?? 0);
  const there = parts.formatToParts(at);
  const here = formatFor(partFormats, undefined, {
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hourCycle: 'h23',
  })!.formatToParts(at);
  const dayOf = (p: Intl.DateTimeFormatPart[]) =>
    Date.UTC(get(p, 'year'), get(p, 'month') - 1, get(p, 'day'));
  return {
    hour: get(there, 'hour') % 24,
    minute: get(there, 'minute'),
    text: text.format(at),
    dayShift: Math.round((dayOf(there) - dayOf(here)) / 86_400_000),
  };
}

/**
 * The zone an Editor typed in the World Clock's Add Zone field, stored by the name the browser gives it, with the
 * label its city suggests: "europe/london" is Europe/London, labelled London, and an alias like "US/Eastern" is
 * America/New_York. Spaces are underscores ("New York" is New_York). Null for a zone this browser does not know.
 */
export function typedClockZone(raw: string): ClockZone | null {
  const typed = raw.trim().replace(/ /g, '_');
  if (!typed) return null;
  let zone: string;
  try {
    zone = new Intl.DateTimeFormat(undefined, { timeZone: typed }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
  const next = { zone, label: zoneCityLabel(zone) };
  return isClockZone(next) ? next : null;
}
