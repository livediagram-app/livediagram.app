import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { collectDeclared } from './declared.ts';
import { isLicenceAllowed } from './licence-id.ts';
import type { LicencesProduct } from './tables.ts';
import { TEXT_SOURCES } from './texts.ts';

// A product's licence tables checks (docs/specs/002-project-scope/third-party-licences.md in each product),
// written once and run by every @<product>/licences over its own tables (its `src/product.test.ts`). Each guards
// something the page would otherwise get wrong quietly: an app missing from the page, a table naming a text the
// pool doesn't hold, a stale override, a binary asset nothing covers, or a dependency with no licence text.

export type LicenceTableChecks = {
  // The emitted asset names (as the bundlers write them) the embedded works must cover, each with the ids of
  // the works that must match it.
  embeddedAssets?: readonly (readonly [asset: string, ids: readonly string[]])[];
};

export function describeLicenceTables(
  product: LicencesProduct,
  { embeddedAssets = [] }: LicenceTableChecks = {},
) {
  const root = resolve(
    product.productRoot instanceof URL ? fileURLToPath(product.productRoot) : product.productRoot,
  );
  const appsDir = join(root, 'apps');
  const appDirs = readdirSync(appsDir).filter((d) => statSync(join(appsDir, d)).isDirectory());
  const { apps, overrides, embedded, distributed = [] } = product;

  describe('the apps', () => {
    it('registers every app in apps/, deployed or distributed, so a new one cannot ship unlisted', () => {
      expect(appDirs.length).toBeGreaterThan(5);
      expect([...apps.map((a) => a.id), ...distributed].toSorted()).toEqual(appDirs.toSorted());
    });

    it('bundles each app with the tool it builds with', () => {
      for (const app of apps) {
        const next = existsSync(join(appsDir, app.id, 'next.config.ts'));
        expect(app.bundler, app.id).toBe(next ? 'next' : 'worker');
      }
    });

    it('puts the static apps in the browser and the workers on the server', () => {
      for (const app of apps) {
        expect(app.side, app.id).toBe(app.bundler === 'next' ? 'browser' : 'server');
      }
    });

    it('labels every app once', () => {
      const labels = apps.map((a) => a.label);
      expect(new Set(labels).size).toBe(labels.length);
    });
  });

  // The texts themselves are the monorepo's one pool (this package's own test checks their checksums and that
  // every one is named by some product).
  describe('the tables', () => {
    it('name only texts in the shared pool', () => {
      const pool = new Set(TEXT_SOURCES.map((t) => t.file));
      const files = [...overrides, ...embedded]
        .flatMap((entry) => entry.texts)
        .flatMap((ref) => ('file' in ref ? [ref.file] : []));
      for (const file of files) expect(pool.has(file), file).toBe(true);
    });
  });

  describe('the overrides', () => {
    it('hold one entry per exact package version', () => {
      const keys = overrides.map((o) => `${o.package}@${o.version}`);
      expect(new Set(keys).size).toBe(keys.length);
      for (const o of overrides) expect(o.version, o.package).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('give every override a text and an allowed licence when it sets one', () => {
      for (const o of overrides) {
        expect(o.texts.length, o.package).toBeGreaterThan(0);
        if (o.licence) expect(isLicenceAllowed(o.licence), o.package).toBe(true);
      }
    });
  });

  describe('the embedded works', () => {
    it('have unique ids, texts, https homepages and allowed licences', () => {
      const ids = embedded.map((w) => w.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const work of embedded) {
        expect(work.texts.length, work.id).toBeGreaterThan(0);
        expect(work.homepage, work.id).toMatch(/^https:\/\//);
        expect(isLicenceAllowed(work.licence), work.id).toBe(true);
      }
    });

    it('trigger on source files that exist', () => {
      for (const work of embedded) {
        if ('sources' in work.trigger) {
          for (const path of work.trigger.sources) {
            expect(existsSync(join(root, path)), `${work.id}: ${path}`).toBe(true);
          }
        }
      }
    });

    if (embeddedAssets.length > 0) {
      it.each(embeddedAssets.map(([asset, ids]) => [asset, ids] as const))(
        'cover %s',
        (asset, ids) => {
          const hits = embedded
            .filter((w) => 'assets' in w.trigger && w.trigger.assets.test(asset))
            .map((w) => w.id);
          for (const id of ids) expect(hits).toContain(id);
        },
      );
    }
  });

  // Each app's declared dependencies, through the generator's own collector on the real install
  // ("Keeping it current"): every one is listed, each with a licence and its text, so a path the monorepo
  // moves or a package with no licence text fails here rather than emptying the page.
  describe('each app', () => {
    const config = { productRoot: root, overrides, embedded };

    it.each(apps.map((app) => [app.id]))('%s lists its own dependencies', (id) => {
      const { declared, collected } = collectDeclared(config, id);
      const listed = collected.works.filter((w) => w.kind === 'package');
      expect(listed.map((w) => w.name).toSorted()).toEqual(declared);
      for (const work of listed) {
        expect(work.texts.length, work.name).toBeGreaterThan(0);
        expect(work.licence, work.name).not.toBe('');
      }
    });

    it('includes what every website is built on', () => {
      expect(collectDeclared(config, 'marketing').declared).toEqual(
        expect.arrayContaining(['next', 'react', 'react-dom']),
      );
    });
  });
}
