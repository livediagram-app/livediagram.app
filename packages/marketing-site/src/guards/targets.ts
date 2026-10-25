import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// What the marketing guards read: every product's marketing app and this package's own source, the shared
// pages they render. One guard, one rule, for all five, so a product can never drift from another.
const REPO = fileURLToPath(new URL('../../../../', import.meta.url));

export const PRODUCTS = ['livediagram', 'liveplanner', 'livedocuments', 'livedesign'] as const;

export type GuardTarget = {
  name: string;
  root: string;
  /** The source folders under `root`, relative to it. */
  dirs: string[];
};

export const TARGETS: GuardTarget[] = [
  ...PRODUCTS.map((p) => ({
    name: `${p} marketing`,
    root: join(REPO, p, 'apps/marketing'),
    dirs: ['app', 'components', 'lib'],
  })),
  {
    name: '@liveworkspace/marketing-site',
    root: join(REPO, 'packages/marketing-site/src'),
    dirs: ['components', 'lib', 'css'],
  },
];

/** The non-test files under `dir` (relative to `root`) whose names match `ext`, as paths relative to `root`. */
export function sources(root: string, dir: string, ext: RegExp): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(root, join(dir, e.name), ext)
      : ext.test(e.name) && !/\.test\./.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}
