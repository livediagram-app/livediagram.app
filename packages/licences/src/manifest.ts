import { LICENCE_APPS } from './apps.ts';
import type { Collected, WorkRecord } from './collect.ts';
import {
  LICENCES_SCHEMA_VERSION,
  type AppId,
  type LicencesManifest,
  type LicencesSection,
  type Side,
  type WorkEntry,
} from './contract.ts';
import { textHash } from './licence-files.ts';

export type Unused = { kind: 'override' | 'embedded'; id: string };

export type BuiltManifest = {
  manifest: LicencesManifest;
  // hash -> normalised text, one file each.
  texts: Map<string, string>;
  unused: Unused[];
};

type Options = {
  overrides: readonly { package: string; version: string }[];
  embedded: readonly { id: string }[];
};

const SIDES: readonly Side[] = ['browser', 'server'];

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Blueprint D4: by name ignoring case, then version, then key for ties.
const byName = (a: WorkRecord, b: WorkRecord) =>
  a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
  a.version.localeCompare(b.version, 'en', { numeric: true }) ||
  a.key.localeCompare(b.key, 'en');

// All apps' works to the page manifest (blueprint "Behaviour and state", step 4).
export function buildManifest(collected: readonly Collected[], options: Options): BuiltManifest {
  const texts = new Map<string, string>();
  const order = new Map(LICENCE_APPS.map((app, i) => [app.id, i]));

  const sections: LicencesSection[] = SIDES.map((side) => {
    const apps = LICENCE_APPS.filter((app) => app.side === side);
    const merged = new Map<string, { work: WorkRecord; apps: Set<AppId> }>();
    for (const { app, works } of collected) {
      if (!apps.some((a) => a.id === app)) continue;
      for (const work of works) {
        const entry = merged.get(work.key) ?? { work, apps: new Set<AppId>() };
        entry.apps.add(app);
        merged.set(work.key, entry);
      }
    }

    const anchors = new Set<string>();
    const entries: WorkEntry[] = [...merged.values()]
      .sort((a, b) => byName(a.work, b.work))
      .map(({ work, apps: shippedIn }) => {
        const base = `${side}-${slug(work.name)}-${slug(work.version)}`;
        let anchor = base;
        for (let n = 2; anchors.has(anchor); n += 1) anchor = `${base}-${n}`;
        anchors.add(anchor);
        return {
          anchor,
          kind: work.kind,
          name: work.name,
          version: work.version,
          licence: work.licence,
          ...(work.carrier ? { carrier: work.carrier } : {}),
          ...(work.homepage ? { homepage: work.homepage } : {}),
          apps: [...shippedIn].sort((a, b) => order.get(a)! - order.get(b)!),
          texts: work.texts.map(({ label, text }) => {
            const hash = textHash(text);
            texts.set(hash, text);
            return { label, hash };
          }),
        };
      });

    return { side, apps: apps.map(({ id, label }) => ({ id, label })), works: entries };
  });

  const sortedTexts = new Map([...texts].sort(([a], [b]) => a.localeCompare(b, 'en')));
  const measured: LicencesManifest['texts'] = {};
  for (const [hash, text] of sortedTexts) {
    measured[hash] = {
      lines: text.split('\n').length - 1,
      bytes: new TextEncoder().encode(text).length,
    };
  }

  const usedOverrides = new Set(collected.flatMap((c) => c.usedOverrides));
  const usedEmbedded = new Set(collected.flatMap((c) => c.usedEmbedded));
  const unused: Unused[] = [
    ...options.overrides
      .map((o) => `${o.package}@${o.version}`)
      .filter((id) => !usedOverrides.has(id))
      .map((id) => ({ kind: 'override' as const, id })),
    ...options.embedded
      .filter((w) => !usedEmbedded.has(w.id))
      .map((w) => ({ kind: 'embedded' as const, id: w.id })),
  ];

  return {
    manifest: { schemaVersion: LICENCES_SCHEMA_VERSION, sections, texts: measured },
    texts: sortedTexts,
    unused,
  };
}

export const serialiseManifest = (manifest: LicencesManifest): string =>
  `${JSON.stringify(manifest, null, 2)}\n`;
