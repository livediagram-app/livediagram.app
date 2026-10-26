import { existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { collectDeclared } from '@liveworkspace/licences/declared';
import { TEXT_SOURCES } from '@liveworkspace/licences/texts';

import { LICENCE_APPS, serverServices } from './apps.ts';
import { EMBEDDED_WORKS } from './embedded-works.ts';
import { OVERRIDES } from './overrides.ts';

const productRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const appsDir = `${productRoot}apps/`;
const config = { productRoot, overrides: OVERRIDES, embedded: EMBEDDED_WORKS };

describe('LICENCE_APPS', () => {
  // Every app that ships (a Worker, with a wrangler.toml); the migrate tool runs from a laptop and ships nothing.
  it('registers every app in liveworkspace/apps/, so a new one cannot ship unlisted', () => {
    const dirs = readdirSync(appsDir).filter(
      (d) => statSync(appsDir + d).isDirectory() && existsSync(`${appsDir}${d}/wrangler.toml`),
    );
    expect(LICENCE_APPS.map((a) => a.id).toSorted()).toEqual(dirs.toSorted());
  });
});

describe('serverServices', () => {
  it('names every service the page lists, Drive, the gateway and status included', () => {
    const phrase = serverServices();
    for (const app of LICENCE_APPS.filter((a) => a.side === 'server'))
      expect(phrase, app.id).toContain(app.label);
    expect(phrase).toMatch(/, Status and Telemetry$/);
  });
});

describe('the tables', () => {
  it('name only texts in the shared pool, and triggers that exist', () => {
    const pool = new Set(TEXT_SOURCES.map((t) => t.file));
    for (const ref of [...OVERRIDES, ...EMBEDDED_WORKS].flatMap((e) => e.texts)) {
      if ('file' in ref) expect(pool.has(ref.file), ref.file).toBe(true);
    }
    for (const work of EMBEDDED_WORKS) {
      if (!('sources' in work.trigger)) continue;
      for (const s of work.trigger.sources) expect(existsSync(productRoot + s), s).toBe(true);
    }
  });
});

// Each app's declared dependencies, through the generator's own collector on the real install
// (liveworkspace/docs/specs/010-site/site.md "Licences"): every one listed, each with a licence and its text.
describe('each app', () => {
  it.each(LICENCE_APPS.map((app) => [app.id]))('%s lists its own dependencies', (id) => {
    const { declared, collected } = collectDeclared(config, id);
    const listed = collected.works.filter((w) => w.kind === 'package');
    expect(listed.map((w) => w.name).toSorted()).toEqual(declared);
    for (const work of listed) {
      expect(work.texts.length, work.name).toBeGreaterThan(0);
      expect(work.licence, work.name).not.toBe('');
    }
  });

  it('includes what the site and the accounts service are built on', () => {
    expect(collectDeclared(config, 'site').declared).toEqual(
      expect.arrayContaining(['next', 'react', 'react-dom']),
    );
    expect(collectDeclared(config, 'accounts').declared).toContain('better-auth');
  });
});
