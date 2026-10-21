import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// docs/specs/016-platform/nextjs.md "One configuration": every app spreads the shared config and keeps only its
// own settings; "Versions": shared packages peer on the React minor the apps run.

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, 'utf8');
const APPS = ['live', 'marketing', 'help', 'telemetry'];
const SHARED_KEYS = [
  'output',
  'distDir',
  'images',
  'typescript',
  'reactCompiler',
  'experimental',
  'env',
];

describe.each(APPS)('apps/%s/next.config.ts', (app) => {
  const source = read(`apps/${app}/next.config.ts`);

  it('spreads the shared config', () => {
    expect(source).toMatch(
      /import \{[^}]*\bliveplannerNextConfig\b[^}]*\} from '@liveplanner\/next-config'/,
    );
    expect(source).toMatch(/\.\.\.liveplannerNextConfig\(/);
  });

  it.each(SHARED_KEYS)('sets no %s of its own', (key) => {
    expect(source).not.toMatch(new RegExp(`^\\s*${key}\\s*:`, 'm'));
  });
});

// The React Compiler runs in the editor alone (docs/specs/016-platform/nextjs.md "One configuration").
it.each(APPS)('apps/%s asks for the React Compiler only if it is the editor', (app) => {
  const source = read(`apps/${app}/next.config.ts`);
  expect(/reactCompiler: true/.test(source)).toBe(app === 'live');
});

describe('shared packages', () => {
  it.each(['packages/ui', 'packages/template-previews'])('%s peers on React 19.3', (pkg) => {
    const peers = JSON.parse(read(`${pkg}/package.json`)).peerDependencies;
    expect(peers.react).toBe('^19.3.0');
    expect(peers['react-dom']).toBe('^19.3.0');
  });
});
