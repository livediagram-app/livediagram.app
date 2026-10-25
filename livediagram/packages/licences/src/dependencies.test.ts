import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { collectDeclared } from '@liveworkspace/licences/declared';

import { LICENCE_APPS } from './apps.ts';
import { EMBEDDED_WORKS } from './embedded-works.ts';
import { OVERRIDES } from './overrides.ts';

const config = {
  productRoot: fileURLToPath(new URL('../../../', import.meta.url)),
  overrides: OVERRIDES,
  embedded: EMBEDDED_WORKS,
};

// Each app's declared dependencies, through the generator's own collector on the real install
// (docs/specs/002-project-scope/third-party-licences.md "Keeping it current"): every one is
// listed, each with a licence and its text, so a path the monorepo moves or a package with no
// licence text fails here rather than emptying the page.
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

  it('includes what every website is built on', () => {
    expect(collectDeclared(config, 'marketing').declared).toEqual(
      expect.arrayContaining(['next', 'react', 'react-dom']),
    );
  });
});
