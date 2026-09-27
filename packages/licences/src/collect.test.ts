import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { collectWorks, type CollectContext, type FileReader } from './collect.ts';
import type { EmbeddedWork } from './embedded-works.ts';
import type { Override } from './overrides.ts';

const MIT =
  'Copyright (c) Someone\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this\n';
const APACHE = 'Apache License\nVersion 2.0, January 2004\n';
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

const store = (key: string, name: string) => `node_modules/.pnpm/${key}/node_modules/${name}`;
const SVGPATH = store('svgpath@2.6.0', 'svgpath');
const NEXT = store('next@16.3.6_react@19.3.0', 'next');
const TFJS = store('@tensorflow+tfjs-core@4.22.0', '@tensorflow/tfjs-core');
const JSQUASH = store('@jsquash+webp@1.5.0', '@jsquash/webp');

function memoryReader(files: Record<string, string>): FileReader {
  return {
    readText: (path) => files[path],
    listFiles: (dir) =>
      Object.keys(files)
        .filter((p) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/'))
        .map((p) => p.slice(dir.length + 1)),
  };
}

const manifest = (fields: Record<string, unknown>) => JSON.stringify(fields);

function baseFiles(): Record<string, string> {
  return {
    [`/r/${SVGPATH}/package.json`]: manifest({
      name: 'svgpath',
      version: '2.6.0',
      license: 'MIT',
      repository: 'fontello/svgpath',
    }),
    [`/r/${SVGPATH}/LICENSE`]: MIT,
    [`/r/${SVGPATH}/lib/path.js`]: '',
    [`/r/${NEXT}/package.json`]: manifest({ name: 'next', version: '16.3.6', license: 'MIT' }),
    [`/r/${NEXT}/license.md`]: MIT,
    [`/r/${NEXT}/dist/compiled/react/package.json`]: manifest({ name: 'react-builtin' }),
    [`/r/${NEXT}/dist/compiled/react/LICENSE`]: 'MIT License\n\nCopyright (c) Meta\n\n' + MIT,
    [`/r/${NEXT}/dist/compiled/react/cjs/react.js`]: '',
    [`/r/${NEXT}/dist/compiled/@scope/thing/package.json`]: manifest({
      name: 'thing',
      version: '2.0.0',
      license: 'ISC',
      homepage: 'https://thing.dev',
    }),
    [`/r/${NEXT}/dist/compiled/@scope/thing/NOTICE`]: 'Thing notice',
    [`/r/${NEXT}/dist/compiled/nolicence/package.json`]: manifest({ name: 'nolicence' }),
    [`/r/${NEXT}/dist/compiled/nameless/package.json`]: manifest({ type: 'module' }),
    [`/r/${NEXT}/dist/compiled/nameless/LICENSE`]: MIT,
    [`/r/${TFJS}/package.json`]: manifest({
      name: '@tensorflow/tfjs-core',
      version: '4.22.0',
      license: 'Apache-2.0',
    }),
    [`/r/${JSQUASH}/package.json`]: manifest({
      name: '@jsquash/webp',
      version: '1.5.0',
      license: 'Apache-2.0',
    }),
    [`/r/${JSQUASH}/LICENSE`]: APACHE,
    [`/r/${JSQUASH}/codec/LICENSE.codec.md`]:
      'libwebp BSD\nRedistribution and use in source and binary forms. Neither the name\n',
    '/texts/tfjs.txt': APACHE,
    '/texts/xnn.txt': MIT,
  };
}

const TFJS_OVERRIDE: Override = {
  package: '@tensorflow/tfjs-core',
  version: '4.22.0',
  texts: [{ label: 'LICENSE (tfjs)', file: 'tfjs.txt' }],
};

const EMBEDDED: EmbeddedWork[] = [
  {
    id: 'xnnpack',
    name: 'XNNPACK',
    version: '5e8033a',
    licence: 'BSD-3-Clause',
    carrier: 'tfjs wasm',
    homepage: 'https://github.com/google/XNNPACK',
    trigger: { assets: /^tfjs\.\w+\.wasm$/ },
    texts: [{ label: 'LICENSE', file: 'xnn.txt' }],
  },
  {
    id: 'libwebp',
    name: 'libwebp',
    version: 'd2e245e',
    licence: 'BSD-3-Clause',
    carrier: '@jsquash/webp',
    homepage: 'https://github.com/webmproject/libwebp',
    trigger: { assets: /^webp_enc\.\w+\.wasm$/ },
    texts: [{ label: 'COPYING', package: '@jsquash/webp', path: 'codec/LICENSE.codec.md' }],
  },
  {
    id: 'lucide',
    name: 'Lucide',
    version: '1.48.0',
    licence: 'ISC',
    carrier: 'livediagram source',
    homepage: 'https://lucide.dev',
    trigger: { sources: ['packages/icons/src/lucide.generated.ts'] },
    texts: [{ label: 'LICENSE', file: 'xnn.txt' }],
  },
];

function context(files = baseFiles(), overrides: Override[] = [TFJS_OVERRIDE]): CollectContext {
  return {
    repoRoot: '/r',
    textsDir: '/texts/',
    reader: memoryReader(files),
    overrides,
    embedded: EMBEDDED,
    textSources: [
      { file: 'tfjs.txt', sources: ['https://x'], sha256: sha(APACHE) },
      { file: 'xnn.txt', sources: ['https://x'], sha256: sha(MIT) },
    ],
  };
}

const collect = (sources: string[], assets: string[] = [], ctx = context()) =>
  collectWorks({ app: 'live', sources, assets }, ctx);

describe('collectWorks: packages', () => {
  it('publishes a package with its licence files, licence id and homepage', () => {
    const { works } = collect([`${SVGPATH}/lib/path.js`, 'apps/live/app/page.tsx']);
    expect(works).toEqual([
      {
        key: 'package:svgpath@2.6.0',
        kind: 'package',
        name: 'svgpath',
        version: '2.6.0',
        licence: 'MIT',
        homepage: 'https://github.com/fontello/svgpath',
        texts: [{ label: 'LICENSE', text: MIT }],
      },
    ]);
  });

  it('publishes every licence file, NOTICE included, in name order', () => {
    const files = baseFiles();
    files[`/r/${SVGPATH}/NOTICE.txt`] = 'Notice\r\n';
    files[`/r/${SVGPATH}/COPYING`] = '   ';
    const { works } = collect([`${SVGPATH}/lib/path.js`], [], context(files));
    expect(works[0]!.texts).toEqual([
      { label: 'LICENSE', text: MIT },
      { label: 'NOTICE.txt', text: 'Notice\n' },
    ]);
  });

  it('fails a package that ships no licence text, naming it', () => {
    expect(() => collect([`${TFJS}/dist/index.js`], [], context(baseFiles(), []))).toThrow(
      /LicenceTextMissing: @tensorflow\/tfjs-core@4\.22\.0/,
    );
  });

  it('uses the override for exactly that version and reports it used', () => {
    const { works, usedOverrides } = collect([`${TFJS}/dist/index.js`]);
    expect(works[0]).toMatchObject({
      licence: 'Apache-2.0',
      texts: [{ label: 'LICENSE (tfjs)', text: APACHE }],
    });
    expect(usedOverrides).toEqual(['@tensorflow/tfjs-core@4.22.0']);
  });

  it('ignores an override for another version', () => {
    const other = { ...TFJS_OVERRIDE, version: '4.21.0' };
    expect(() => collect([`${TFJS}/dist/index.js`], [], context(baseFiles(), [other]))).toThrow(
      /LicenceTextMissing/,
    );
  });

  it('lets an override set the licence id', () => {
    const override = { ...TFJS_OVERRIDE, licence: 'Apache-2.0 AND MIT' };
    const { works } = collect([`${TFJS}/dist/index.js`], [], context(baseFiles(), [override]));
    expect(works[0]!.licence).toBe('Apache-2.0 AND MIT');
  });

  it('leaves an override unused when the package ships its own text', () => {
    const override = { ...TFJS_OVERRIDE, package: 'svgpath', version: '2.6.0' };
    const { usedOverrides } = collect([`${SVGPATH}/a.js`], [], context(baseFiles(), [override]));
    expect(usedOverrides).toEqual([]);
  });

  it('recognises the licence from the text when package.json names none', () => {
    const files = baseFiles();
    files[`/r/${SVGPATH}/package.json`] = manifest({ name: 'svgpath', version: '2.6.0' });
    expect(collect([`${SVGPATH}/a.js`], [], context(files)).works[0]!.licence).toBe('MIT');
  });

  it('fails a licence it cannot name', () => {
    const files = baseFiles();
    files[`/r/${SVGPATH}/package.json`] = manifest({ name: 'svgpath', version: '2.6.0' });
    files[`/r/${SVGPATH}/LICENSE`] = 'All rights reserved.';
    expect(() => collect([`${SVGPATH}/a.js`], [], context(files))).toThrow(
      /LicenceIdUnknown: svgpath@2\.6\.0/,
    );
  });

  it('fails a licence outside the allowlist', () => {
    const files = baseFiles();
    files[`/r/${SVGPATH}/package.json`] = manifest({
      name: 'svgpath',
      version: '2.6.0',
      license: 'GPL-3.0-only',
    });
    expect(() => collect([`${SVGPATH}/a.js`], [], context(files))).toThrow(
      /LicenceNotAllowed: svgpath@2\.6\.0 is GPL-3\.0-only/,
    );
  });

  it('skips a licence file that vanishes between listing and reading', () => {
    const reader = memoryReader(baseFiles());
    const ctx = {
      ...context(),
      reader: {
        ...reader,
        listFiles: (dir: string) => [...reader.listFiles(dir), 'LICENSE-GONE'],
      },
    };
    expect(collect([`${SVGPATH}/a.js`], [], ctx).works[0]!.texts).toHaveLength(1);
  });

  it.each([
    ['missing', undefined],
    ['JSON but not an object', 'null'],
    ['not JSON', '{'],
    ['for another name', manifest({ name: 'other', version: '2.6.0' })],
    ['without a version', manifest({ name: 'svgpath' })],
  ])('fails a package.json that is %s', (_, content) => {
    const files = baseFiles();
    if (content === undefined) delete files[`/r/${SVGPATH}/package.json`];
    else files[`/r/${SVGPATH}/package.json`] = content;
    expect(() => collect([`${SVGPATH}/a.js`], [], context(files))).toThrow(
      /PackageManifestInvalid/,
    );
  });

  it('fails when the installed version is not the locked one', () => {
    const files = baseFiles();
    files[`/r/${SVGPATH}/package.json`] = manifest({
      name: 'svgpath',
      version: '2.7.0',
      license: 'MIT',
    });
    expect(() => collect([`${SVGPATH}/a.js`], [], context(files))).toThrow(
      /VersionMismatch: svgpath is 2\.7\.0 but the lockfile resolved 2\.6\.0/,
    );
  });
});

describe('collectWorks: vendored works', () => {
  it('lists a vendored work with its own name and licence file, inside its carrier', () => {
    const { works } = collect([`${NEXT}/dist/compiled/react/cjs/react.js`]);
    expect(works.map((w) => [w.kind, w.name, w.version, w.licence, w.carrier])).toEqual([
      ['package', 'next', '16.3.6', 'MIT', undefined],
      ['vendored', 'react', 'bundled in next 16.3.6', 'MIT', 'next 16.3.6'],
    ]);
  });

  it('keeps a scoped vendored name and its own version and licence', () => {
    const { works } = collect([`${NEXT}/dist/compiled/@scope/thing/index.js`]);
    expect(works[1]).toMatchObject({
      name: '@scope/thing',
      version: '2.0.0',
      licence: 'ISC',
      homepage: 'https://thing.dev/',
    });
  });

  it('leaves directories without a name or a licence file to their package', () => {
    const { works } = collect([
      `${NEXT}/dist/compiled/nolicence/a.js`,
      `${NEXT}/dist/compiled/nameless/a.js`,
    ]);
    expect(works.map((w) => w.name)).toEqual(['next']);
  });

  it('fails a vendored work whose licence it cannot name', () => {
    const files = baseFiles();
    files[`/r/${NEXT}/dist/compiled/react/LICENSE`] = 'Custom terms';
    expect(() => collect([`${NEXT}/dist/compiled/react/a.js`], [], context(files))).toThrow(
      /LicenceIdUnknown: react \(bundled in next 16\.3\.6\)/,
    );
  });
});

describe('collectWorks: embedded works', () => {
  it('fails an emitted binary no entry reviews', () => {
    expect(() => collect([], ['mystery.abc.wasm'])).toThrow(
      /UnreviewedBinaryAsset: live emits mystery\.abc\.wasm/,
    );
  });

  it('counts an upper-case extension as a binary', () => {
    expect(() => collect([], ['MYSTERY.WOFF2'])).toThrow(/UnreviewedBinaryAsset/);
  });

  it('ignores emitted files that are not binaries', () => {
    expect(collect([], ['chunk.js', 'style.css']).works).toEqual([]);
  });

  it('lists the works inside a reviewed binary with their committed texts', () => {
    const { works, usedEmbedded } = collect([], ['tfjs.a1.wasm']);
    expect(works).toEqual([
      {
        key: 'embedded:xnnpack',
        kind: 'embedded',
        name: 'XNNPACK',
        version: '5e8033a',
        licence: 'BSD-3-Clause',
        carrier: 'tfjs wasm',
        homepage: 'https://github.com/google/XNNPACK',
        texts: [{ label: 'LICENSE', text: MIT }],
      },
    ]);
    expect(usedEmbedded).toEqual(['xnnpack']);
  });

  it('reads a text from inside a package the bundle ships', () => {
    const { works } = collect([`${JSQUASH}/encode.js`], ['webp_enc.x1.wasm']);
    expect(works.find((w) => w.name === 'libwebp')!.texts[0]!.label).toBe('COPYING');
  });

  it('fails a package text when that package does not ship', () => {
    expect(() => collect([], ['webp_enc.x1.wasm'])).toThrow(
      /EmbeddedPackageNotShipped: libwebp reads @jsquash\/webp/,
    );
  });

  it('fails a package text that is not there', () => {
    const files = baseFiles();
    delete files[`/r/${JSQUASH}/codec/LICENSE.codec.md`];
    expect(() => collect([`${JSQUASH}/encode.js`], ['webp_enc.x1.wasm'], context(files))).toThrow(
      /LicenceTextMissing: libwebp: @jsquash\/webp\/codec\/LICENSE\.codec\.md/,
    );
  });

  it('lists vendored source material when its file is bundled', () => {
    expect(collect(['packages/icons/src/lucide.generated.ts']).works.map((w) => w.name)).toEqual([
      'Lucide',
    ]);
    expect(collect(['packages/icons/src/other.ts']).works).toEqual([]);
  });

  it('fails a committed text that was edited', () => {
    const files = baseFiles();
    files['/texts/xnn.txt'] = `${MIT}edited\n`;
    expect(() => collect([], ['tfjs.a1.wasm'], context(files))).toThrow(
      /TextSourceIntegrity: xnn\.txt/,
    );
  });

  it('fails a committed text that is missing or unlisted', () => {
    const files = baseFiles();
    delete files['/texts/xnn.txt'];
    expect(() => collect([], ['tfjs.a1.wasm'], context(files))).toThrow(
      /TextSourceIntegrity: xnn\.txt/,
    );
    const ctx = { ...context(), textSources: [] };
    expect(() => collect([], ['tfjs.a1.wasm'], ctx)).toThrow(
      /TextSourceIntegrity: xnn\.txt is not listed/,
    );
  });

  it('fails an embedded work whose table licence is not allowed', () => {
    const ctx = { ...context(), embedded: [{ ...EMBEDDED[0]!, licence: 'GPL-2.0-only' }] };
    expect(() => collect([], ['tfjs.a1.wasm'], ctx)).toThrow(/LicenceNotAllowed: XNNPACK/);
  });
});
