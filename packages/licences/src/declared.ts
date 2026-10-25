import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { collectWorks, type Collected } from './collect.ts';
import { nodeReader } from './node-reader.ts';
import type { EmbeddedWork, Override } from './tables.ts';
import { TEXT_SOURCES, TEXTS_DIR } from './texts.ts';

// What a product's dependency test hands over: its folder and its own tables.
export type DeclaredConfig = {
  productRoot: URL | string;
  overrides: readonly Override[];
  embedded: readonly EmbeddedWork[];
};

// The third-party packages an app declares in its package.json `dependencies` (`workspace:`
// packages are first-party).
export function declaredDependencies(appDir: string): string[] {
  const manifest = JSON.parse(readFileSync(join(appDir, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  return Object.entries(manifest.dependencies ?? {})
    .filter(([, range]) => !range.startsWith('workspace:'))
    .map(([name]) => name)
    .sort();
}

// Where an installed package lives: the app's own node_modules link, else the nearest one above
// it (pnpm hoists nothing, but a product's root package may hold the link).
function installed(appDir: string, name: string): string {
  for (let dir = appDir; ; dir = dirname(dir)) {
    const link = join(dir, 'node_modules', name);
    if (existsSync(link)) return realpathSync(link);
    if (dirname(dir) === dir) throw new Error(`${name} is not installed for ${appDir}`);
  }
}

// The works the page would list for an app that bundled one file of each package it declares,
// on the real install and through the generator's own collector (docs/specs/002-project-scope/
// third-party-licences.md "Keeping it current", in each product). A path the monorepo moves, a
// package with no licence text or an unreviewed licence fails a unit test, not the site's build.
export function collectDeclared(
  config: DeclaredConfig,
  appId: string,
): { declared: string[]; collected: Collected } {
  const root = resolve(
    config.productRoot instanceof URL ? fileURLToPath(config.productRoot) : config.productRoot,
  );
  const appDir = join(root, 'apps', appId);
  const declared = declaredDependencies(appDir);
  const sources = declared.map((name) =>
    relative(root, join(installed(appDir, name), 'package.json'))
      .split('\\')
      .join('/'),
  );
  const collected = collectWorks(
    { app: appId, sources, assets: [] },
    {
      repoRoot: root,
      textsDir: TEXTS_DIR,
      reader: nodeReader,
      overrides: config.overrides,
      embedded: config.embedded,
      textSources: TEXT_SOURCES,
    },
  );
  return { declared, collected };
}
