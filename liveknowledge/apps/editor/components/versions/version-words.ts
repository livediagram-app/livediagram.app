// The Version History panel's words (docs/specs/006-document/version-history.md "In the editor"): what each kind of
// version is called, the rail's day headings, a row's time and the name a copy is given. Pure, over a clock and the
// viewer's locale, so the tests pin both.
import type { VersionKind, VersionSummary } from '@liveknowledge/api-schema';

const KIND_WORDS: Record<VersionKind, string> = {
  save: 'Saved',
  idle: 'Automatic',
  agent: 'Before an AI edit',
  restore: 'Before restoring',
  manual: 'Named',
};

/** A row's title: its name, else its kind in words. */
export function versionTitle(version: Pick<VersionSummary, 'name' | 'kind'>): string {
  return version.name ?? KIND_WORDS[version.kind];
}

/** The kind in words, for the selected version's line. */
export function kindWords(kind: VersionKind): string {
  return KIND_WORDS[kind];
}

const DAY_MS = 86_400_000;

function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The rail's heading for the day a version was kept: Today, Yesterday, the weekday within the week, then the date
 *  (with the year when it is not this year's). */
export function dayHeading(at: number, now: number, locale?: string): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const date = new Date(at);
  if (days < 7) return date.toLocaleDateString(locale, { weekday: 'long' });
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** A row's time of day, in the viewer's own clock. */
export function timeOfDay(at: number, locale?: string): string {
  return new Date(at).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/** When a version was kept, in a sentence: "today at 9:30", "yesterday at 14:05", "on 3 November at 9:30". */
export function whenWords(at: number, now: number, locale?: string): string {
  const heading = dayHeading(at, now, locale);
  const time = timeOfDay(at, locale);
  if (heading === 'Today' || heading === 'Yesterday') return `${heading.toLowerCase()} at ${time}`;
  return `on ${heading} at ${time}`;
}

export type VersionDay = { heading: string; versions: VersionSummary[] };

/** The versions (newest first) under their day headings, in order. */
export function versionsByDay(
  versions: readonly VersionSummary[],
  now: number,
  locale?: string,
): VersionDay[] {
  const days: VersionDay[] = [];
  for (const version of versions) {
    const heading = dayHeading(version.savedAt, now, locale);
    const last = days.at(-1);
    if (last?.heading === heading) last.versions.push(version);
    else days.push({ heading, versions: [version] });
  }
  return days;
}

/** The name Make a Copy gives the new tab: "<tab name> (14 Nov)". */
export function copyName(tabName: string, at: number, locale?: string): string {
  const day = new Date(at).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  return `${tabName} (${day})`;
}
