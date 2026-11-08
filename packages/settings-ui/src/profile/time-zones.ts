// The zones Settings › Profile › Time Zone offers (liveworkspace/docs/specs/010-site/site.md "Settings", "Profile"):
// every zone this browser knows, each with its city, region and offset now, sorted by offset and then city. A zone's
// offset needs an Intl.DateTimeFormat of its own, and making about 420 of them costs tens of milliseconds, so nothing
// is built until asked for: the row's label makes one for the zone in force, and the full list is built the first
// time the picker opens, then kept for the page. Its own module, with no React.

export type ZoneOption = {
  // The IANA name, as the accounts API keeps it.
  id: string;
  // "New York", "Buenos Aires", "UTC".
  city: string;
  // "America", "Argentina, America"; empty for a zone with no region.
  region: string;
  // "GMT+0", "GMT−5", "GMT+5:30", with a true minus sign.
  offset: string;
  // Minutes east of GMT, for the sort.
  minutes: number;
  // What a search matches, lower case, the minus as a hyphen.
  haystack: string;
};

/** The zone this browser is in, or null when it won't say. */
export function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

const options = new Map<string, ZoneOption | null>();
let list: readonly ZoneOption[] | null = null;

function offsetOf(zone: string, now: number): { offset: string; minutes: number } | null {
  let name: string | undefined;
  try {
    name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(now)
      .find((part) => part.type === 'timeZoneName')?.value;
  } catch {
    return null;
  }
  // "GMT", "GMT+1", "GMT-5", "GMT+5:30", "GMT−3" (some engines write a true minus).
  const match = /^(?:GMT|UTC)(?:([+\-\u2212])(\d{1,2})(?::(\d{2}))?)?$/.exec(name ?? '');
  if (!match) return null;
  const sign = match[1] && match[1] !== '+' ? -1 : 1;
  const hours = Number(match[2] ?? 0);
  const mins = Number(match[3] ?? 0);
  const minutes = sign * (hours * 60 + mins);
  const tail = `${hours}${mins ? `:${String(mins).padStart(2, '0')}` : ''}`;
  return { offset: `GMT${sign < 0 ? '\u2212' : '+'}${tail}`, minutes };
}

function build(zone: string, now: number): ZoneOption | null {
  const offset = offsetOf(zone, now);
  if (!offset) return null;
  const parts = zone.replace(/^Etc\//, '').split('/');
  const city = parts[parts.length - 1]!.replace(/_/g, ' ');
  const region = parts.slice(0, -1).reverse().join(', ').replace(/_/g, ' ');
  const haystack = `${zone} ${city} ${region} ${offset.offset}`
    .toLowerCase()
    .replace(/\u2212/g, '-')
    .replace(/_/g, ' ');
  return { id: zone, city, region, ...offset, haystack };
}

/** One zone, made the first time it is asked for and kept; null for a name this browser doesn't know. */
export function zoneOption(zone: string, now = Date.now()): ZoneOption | null {
  if (!options.has(zone)) options.set(zone, build(zone, now));
  return options.get(zone)!;
}

const byOffsetThenCity = (a: ZoneOption, b: ZoneOption) =>
  a.minutes - b.minutes || a.city.localeCompare(b.city);

// Places IANA renamed whose old name some engines still report or list (their ICU keeps it as canonical): the old
// name to the new. A browser in India can say Asia/Calcutta while another lists Asia/Kolkata.
const RENAMED: Record<string, string> = {
  'Africa/Asmera': 'Africa/Asmara',
  'America/Godthab': 'America/Nuuk',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Europe/Kiev': 'Europe/Kyiv',
  'Pacific/Enderbury': 'Pacific/Kanton',
};

const places = new Map<string, string>();

// The place a zone names, the same for a zone and its old alias: the engine's own canonical name, then the newer
// name of a place renamed. Made once per zone, and only for zones this engine knows (each has an option) that
// might be the same place as one handed in.
function placeOf(zone: string): string {
  let place = places.get(zone);
  if (place === undefined) {
    const resolved = new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone;
    place = RENAMED[resolved] ?? resolved;
    places.set(zone, place);
  }
  return place;
}

/** Every zone this browser knows, and any of `also` it leaves out (the zone kept, this browser's own), by offset
 *  then city. The browser's list is read and its options made once per page; `also` only adds what is missing. A
 *  zone handed in that is another name for a listed place (Asia/Calcutta beside Asia/Kolkata) takes that place's
 *  entry, under the name handed in, so the place shows once and the zone kept still reads as chosen; the first
 *  handed in wins. */
export function zoneOptions(also: readonly (string | null | undefined)[] = []): ZoneOption[] {
  if (!list) {
    let zones: string[] = [];
    try {
      zones = Intl.supportedValuesOf('timeZone');
    } catch {
      // An engine without the list (Safari before 15.4) still offers the zones it was handed, and UTC.
    }
    const now = Date.now();
    const made = new Set<string>();
    const all: ZoneOption[] = [];
    for (const zone of [...zones, 'UTC']) {
      const option = zoneOption(zone, now);
      if (option && !made.has(option.id)) {
        made.add(option.id);
        all.push(option);
      }
    }
    list = all.sort(byOffsetThenCity);
  }
  const result = [...list];
  // The entries a zone handed in has claimed: a later one never takes them over.
  const claimed = new Set<string>();
  let changed = false;
  for (const zone of also) {
    if (!zone || claimed.has(zone)) continue;
    if (result.some((option) => option.id === zone)) {
      claimed.add(zone);
      continue;
    }
    const option = zoneOption(zone);
    if (!option) continue;
    // Only a zone at the same offset now can be the same place, so few are ever resolved.
    const place = placeOf(zone);
    const at = result.findIndex(
      (listed) => listed.minutes === option.minutes && placeOf(listed.id) === place,
    );
    if (at >= 0 && claimed.has(result[at]!.id)) continue;
    if (at >= 0) result[at] = option;
    else result.push(option);
    claimed.add(zone);
    changed = true;
  }
  return changed ? result.sort(byOffsetThenCity) : result;
}

/** The options a search keeps: every word of it somewhere in the zone's name, city, region or offset. */
export function filterZones(zones: readonly ZoneOption[], query: string): readonly ZoneOption[] {
  const words = query
    .toLowerCase()
    .replace(/\u2212/g, '-')
    .replace(/_/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return zones;
  return zones.filter((zone) => words.every((word) => zone.haystack.includes(word)));
}

/** A zone as its row and button read it: "Tokyo (GMT+9)", or the IANA name when the browser doesn't know it. */
export function zoneLabel(zone: string): string {
  const option = zoneOption(zone);
  return option ? `${option.city} (${option.offset})` : zone;
}

/** For tests: forget what was built, as a new page would. */
export function resetZoneOptions(): void {
  options.clear();
  places.clear();
  list = null;
}
