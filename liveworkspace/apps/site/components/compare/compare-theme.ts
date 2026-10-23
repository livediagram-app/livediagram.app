import { PLATFORM_SITE, type SiteId } from '@liveworkspace/sites';
import type { CSSProperties } from 'react';
import { listedApps, type ListedApp } from '@/lib/apps';

// Who a comparison speaks for, and in whose colours (liveworkspace/docs/comparison-pages.md "Page
// shape"): one app's comparison is that app's, in its accent; a suite comparison is
// liveworkspace's, in the platform's slate.
export type CompareVoice = {
  name: string;
  // Its deep shade (white text on it passes WCAG AA) and its accent, for the page's tints.
  deep: string;
  accent: string;
  // The apps the comparison is about, in the shared order.
  apps: ListedApp[];
};

// slate-700: the platform's deep shade, as each app's brand-700 is theirs.
const PLATFORM_DEEP = '#334155';

export function compareVoice(ids: SiteId[]): CompareVoice {
  const apps = listedApps().filter((app) => ids.includes(app.id));
  const only = apps.length === 1 ? apps[0] : undefined;
  return only
    ? { name: only.name, deep: only.deep, accent: only.accent, apps }
    : { name: PLATFORM_SITE.name, deep: PLATFORM_DEEP, accent: PLATFORM_SITE.accent, apps };
}

// The custom properties the compare components colour themselves from: --lw-ink and
// --lw-ink-dark as the rest of the site uses them, and --lw-accent for washes.
export function voiceStyle(voice: CompareVoice): CSSProperties {
  return {
    '--lw-ink': voice.deep,
    '--lw-ink-dark': voice.accent,
    '--lw-accent': voice.accent,
  } as CSSProperties;
}

// Each app's call to action on a comparison: its own site's primary button words, and where it
// leads, measured as Compare.Card by that app's landing funnel (the `via` its /new reads).
const START: Record<SiteId, string> = {
  'liveworkspace.app': 'Pick an app',
  'livediagram.app': 'Start drawing',
  'liveplanner.app': 'Start planning',
  'livedocuments.app': 'Start creating',
  'livedesign.app': 'Start creating',
};

export function startLabel(app: ListedApp): string {
  return START[app.id];
}

export function startHref(app: ListedApp): string {
  return `${app.url}/new?via=Compare.Card`;
}
