// The words the Explorer says about what it lists. liveplanner's Explorer says "plan" everywhere; here each
// app's own kind (Canvas, Plan, Document, Design) takes its place, and the All filter, which mixes every app,
// says "item". New always makes the host app's kind, whatever the filter shows.

import { APP_KINDS, type App, type Kind } from '@liveworkspace/index-client';
import { APP_SITES, type Site } from '@liveworkspace/sites';

// What the Explorer lists: this app's items, or every app's.
export type AppFilter = 'app' | 'all';

export type Words = {
  // "Plan", "Plans": a title or a button ("New Plan").
  one: string;
  many: string;
  // "plan", "plans": inside a sentence.
  lowerOne: string;
  lowerMany: string;
};

const KIND_WORDS: Record<Kind, { one: string; many: string }> = {
  canvas: { one: 'Canvas', many: 'Canvases' },
  plan: { one: 'Plan', many: 'Plans' },
  document: { one: 'Document', many: 'Documents' },
  design: { one: 'Design', many: 'Designs' },
};

function words(one: string, many: string): Words {
  return { one, many, lowerOne: one.toLowerCase(), lowerMany: many.toLowerCase() };
}

/** The words for one app's kind ("Plan" on liveplanner). */
export function kindWords(app: App): Words {
  const w = KIND_WORDS[APP_KINDS[app]];
  return words(w.one, w.many);
}

const ITEM_WORDS = words('Item', 'Items');

/** The words a list uses: the app's kind, or "item" while it shows every app. */
export function listWords(app: App, filter: AppFilter): Words {
  return filter === 'all' ? ITEM_WORDS : kindWords(app);
}

/** The site an app lives on, for its mark (name and accent) on a row in the All filter. */
export function siteOf(app: App): Site {
  const site = APP_SITES.find((s) => s.id === `${app}.app`);
  // Every app has a site (a test pins it); the fallback keeps a new app from crashing a row.
  return site ?? { id: 'liveworkspace.app', name: app, url: '', pitch: '', accent: '#64748b' };
}
