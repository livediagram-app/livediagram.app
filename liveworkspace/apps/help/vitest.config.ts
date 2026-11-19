import { fileURLToPath } from 'node:url';
import { defineProject } from '@liveworkspace/vitest-config';

// Node is the default environment: most suites check content (the catalogue, article links, repo paths in docs).
// `jsx: 'automatic'` because some suites import .tsx modules for their data (icon maps are records of JSX).
//
// One project per edition, each with the build's generated modules pointed at its scope, so an edition's suites
// (editions/<scope>/tests) import `@/lib/help-site` and `@/lib/articles` as that scope's build does. The framework's
// own suites (src, scripts, lib: the guards over the whole article tree in lib/guards, the search-index caps) run as
// livediagram, the checked-in scope. An edition's .tsx suites (livehuddle's scene and figure checks) render with
// react-dom/server, so node stays their environment too.
const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const SCOPES = ['livediagram', 'liveplanner', 'livedocuments', 'livedesign', 'livehuddle', 'all'];

const scoped = (scope: string) => [
  { find: '@/lib/scope.generated', replacement: here(`./lib/scopes/${scope}.ts`) },
  { find: '@/lib/bindings.generated', replacement: here(`./lib/bindings/${scope}`) },
  { find: './scope.generated', replacement: here(`./lib/scopes/${scope}.ts`) },
  { find: './bindings.generated', replacement: here(`./lib/bindings/${scope}`) },
  { find: './current.generated', replacement: here(`./editions/${scope}/edition.ts`) },
  { find: '@', replacement: here('.') },
];

export default defineProject({
  test: {
    projects: [
      {
        extends: true,
        oxc: { jsx: { runtime: 'automatic' } },
        resolve: { alias: scoped('livediagram') },
        test: { name: 'framework', include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'lib/**/*.test.ts'] },
      },
      ...SCOPES.map((scope) => ({
        extends: true,
        oxc: { jsx: { runtime: 'automatic' as const } },
        resolve: { alias: scoped(scope) },
        test: { name: scope, include: [`editions/${scope}/tests/**/*.test.{ts,tsx}`] },
      })),
    ],
  },
});
