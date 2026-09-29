import { describe, expect, it } from 'vitest';

import { decodeMetafile } from './metafile.ts';

describe('decodeMetafile', () => {
  it('turns input keys relative to the worker into repo-relative paths', () => {
    const meta = {
      inputs: {
        'src/index.ts': { bytes: 1 },
        '../../node_modules/.pnpm/hono@4.13.8/node_modules/hono/dist/index.js': { bytes: 2 },
        '../../packages/icons/src/index.ts': { bytes: 3 },
      },
      outputs: {},
    };
    expect(decodeMetafile(meta, 'apps/mcp')).toEqual([
      'apps/mcp/src/index.ts',
      'node_modules/.pnpm/hono@4.13.8/node_modules/hono/dist/index.js',
      'packages/icons/src/index.ts',
    ]);
  });

  it('skips virtual modules that live in no file', () => {
    const meta = { inputs: { 'cloudflare:workers': {}, '<runtime>': {}, 'src/a.ts': {} } };
    expect(decodeMetafile(meta, 'apps/api')).toEqual(['apps/api/src/a.ts']);
  });

  it.each([
    ['no object', null],
    ['no inputs', { outputs: {} }],
    ['inputs that are not an object', { inputs: [] }],
  ])('refuses %s', (_, meta) => {
    expect(() => decodeMetafile(meta, 'apps/api')).toThrow(/MetafileFormatUnrecognised/);
  });

  it('refuses an input outside the repository', () => {
    expect(() => decodeMetafile({ inputs: { '../../../elsewhere.js': {} } }, 'apps/api')).toThrow(
      /MetafileFormatUnrecognised.*outside/,
    );
  });
});
