import { describe, expect, it } from 'vitest';

import type { Collected, WorkRecord } from './collect.ts';
import { textHash } from './licence-files.ts';
import { buildManifest, serialiseManifest } from './manifest.ts';

const MIT = 'MIT text\n';
const ISC = 'ISC text — ünïcode\n\n';

const work = (name: string, version: string, over: Partial<WorkRecord> = {}): WorkRecord => ({
  key: `package:${name}@${version}`,
  kind: 'package',
  name,
  version,
  licence: 'MIT',
  texts: [{ label: 'LICENSE', text: MIT }],
  ...over,
});

const collected = (app: Collected['app'], works: WorkRecord[], used: Partial<Collected> = {}) => ({
  app,
  works,
  usedOverrides: [],
  usedEmbedded: [],
  ...used,
});

const options = {
  overrides: [
    { package: 'seedrandom', version: '3.0.5', texts: [] },
    { package: 'old', version: '1.0.0', texts: [] },
  ],
  embedded: [{ id: 'xnnpack' }, { id: 'libwebp' }],
};

function build(input: Collected[]) {
  return buildManifest(input, options);
}

describe('buildManifest', () => {
  it('splits works into the browser and server sections, apps in registry order', () => {
    const { manifest } = build([
      collected('api', [work('svgpath', '2.6.0')]),
      collected('marketing', [work('svgpath', '2.6.0')]),
      collected('live', [work('svgpath', '2.6.0'), work('dequal', '2.0.3')]),
    ]);
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.sections.map((s) => [s.side, s.apps.map((a) => a.label)])).toEqual([
      ['browser', ['Editor', 'Website', 'Help centre', 'Telemetry']],
      ['server', ['API', 'MCP server', 'Router']],
    ]);
    expect(manifest.sections[0]!.works.map((w) => [w.name, w.apps])).toEqual([
      ['dequal', ['live']],
      ['svgpath', ['live', 'marketing']],
    ]);
    expect(manifest.sections[1]!.works.map((w) => [w.name, w.apps])).toEqual([
      ['svgpath', ['api']],
    ]);
  });

  it('shares one file between works with the same text and measures it', () => {
    const { manifest, texts } = build([
      collected('live', [
        work('a', '1.0.0'),
        work('b', '1.0.0', { licence: 'ISC', texts: [{ label: 'COPYING', text: ISC }] }),
        work('c', '1.0.0'),
      ]),
    ]);
    expect([...texts.keys()]).toEqual([textHash(ISC), textHash(MIT)].sort());
    expect(manifest.texts[textHash(MIT)]).toEqual({ lines: 1, bytes: 9 });
    expect(manifest.texts[textHash(ISC)]).toEqual({ lines: 2, bytes: 24 });
    expect(manifest.sections[0]!.works.map((w) => w.texts)).toEqual([
      [{ label: 'LICENSE', hash: textHash(MIT) }],
      [{ label: 'COPYING', hash: textHash(ISC) }],
      [{ label: 'LICENSE', hash: textHash(MIT) }],
    ]);
  });

  it('orders by name ignoring case, then by version, and anchors each entry uniquely', () => {
    const { manifest } = build([
      collected('live', [
        work('long', '5.3.2'),
        work('XNNPACK', '5e8033a', { key: 'embedded:xnnpack', kind: 'embedded', carrier: 'tfjs' }),
        work('long', '4.0.0'),
        work('@clerk/react', '6.17.0', { homepage: 'https://clerk.com/' }),
        work('process', 'bundled in next 16.3.6', { key: 'vendored:x/process', kind: 'vendored' }),
        work('Process', 'bundled in next 16.3.6', { key: 'vendored:y/process', kind: 'vendored' }),
      ]),
    ]);
    const works = manifest.sections[0]!.works;
    expect(works.map((w) => [w.name, w.version, w.anchor])).toEqual([
      ['@clerk/react', '6.17.0', 'browser-clerk-react-6-17-0'],
      ['long', '4.0.0', 'browser-long-4-0-0'],
      ['long', '5.3.2', 'browser-long-5-3-2'],
      ['process', 'bundled in next 16.3.6', 'browser-process-bundled-in-next-16-3-6'],
      ['Process', 'bundled in next 16.3.6', 'browser-process-bundled-in-next-16-3-6-2'],
      ['XNNPACK', '5e8033a', 'browser-xnnpack-5e8033a'],
    ]);
    expect(works[0]).toMatchObject({ homepage: 'https://clerk.com/' });
    expect(works[0]).not.toHaveProperty('carrier');
    expect(works[5]).toMatchObject({ kind: 'embedded', carrier: 'tfjs' });
    expect(works[5]).not.toHaveProperty('homepage');
  });

  it('reports table entries no app used', () => {
    const { unused } = build([
      collected('live', [], { usedOverrides: ['seedrandom@3.0.5'], usedEmbedded: ['xnnpack'] }),
    ]);
    expect(unused).toEqual([
      { kind: 'override', id: 'old@1.0.0' },
      { kind: 'embedded', id: 'libwebp' },
    ]);
  });

  it('serialises the same input to the same bytes', () => {
    const input = [collected('live', [work('b', '1.0.0'), work('a', '1.0.0')])];
    const text = serialiseManifest(build(input).manifest);
    expect(text.endsWith('}\n')).toBe(true);
    expect(serialiseManifest(build(input).manifest)).toBe(text);
    expect(JSON.parse(text)).toEqual(build(input).manifest);
  });
});
