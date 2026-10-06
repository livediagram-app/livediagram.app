// The CLI as a publishable package (docs/specs/015-api/blueprints/cli.md CLI1, CLI2): dist/livediagram.mjs, every
// workspace package and dependency bundled for Node 22 and later, beside the package.json npm publishes (named
// `@livediagram/cli` like the workspace; dist sits outside the workspace globs), the licence, the user README and the notices of every
// bundled package, read from esbuild's metafile; beside the bundle the PNG renderer's wasm and font (CLI31), which only a
// render reads, and the font's licence. A bundled package without a licence fails the build.

import { build } from 'esbuild';
import { chmod, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { EMBEDDED_WORKS } from '../../../packages/licences/src/embedded-works.ts';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(app, '../..');
const dist = join(app, 'dist');
const outfile = join(dist, 'livediagram.mjs');

const result = await build({
  entryPoints: [join(app, 'src/bin.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // bin.ts carries the shebang; esbuild keeps it on the first line. The notices travel in THIRD_PARTY_LICENSES.
  legalComments: 'none',
  metafile: true,
  // Metafile paths are relative to this directory.
  absWorkingDir: app,
  logLevel: 'info',
});
await chmod(outfile, 0o755);

// The PNG renderer's files, under the names the CLI reads them by (CLI31); `from` is the name the licences table
// knows each by.
const requireHere = createRequire(import.meta.url);
const fonts = join(repo, 'packages/render-png/fonts');
const ASSETS = [
  { from: requireHere.resolve('@resvg/resvg-wasm/index_bg.wasm'), to: 'resvg.wasm' },
  { from: join(fonts, 'Inter-Regular.ttf'), to: 'Inter-Regular.ttf' },
  { from: join(fonts, 'Inter-OFL.txt'), to: 'Inter-OFL.txt' },
];
for (const { from, to } of ASSETS) await copyFile(from, join(dist, to));
const assetNames = ASSETS.map(({ from }) => from.split('/').at(-1));

// The package directory holding a bundled file: the nearest node_modules/<name> or node_modules/@scope/<name>.
function packageDirOf(input) {
  const parts = input.split('/');
  const at = parts.lastIndexOf('node_modules');
  if (at === -1) return null;
  const length = parts[at + 1]?.startsWith('@') ? 3 : 2;
  return resolve(app, parts.slice(0, at + length).join('/'));
}

const LICENCE_FILE = /^(licen[cs]e|copying|notice)(\.|$)/i;

async function noticeOf(dir) {
  const pkg = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
  const licence = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type;
  if (!licence)
    throw new Error(`[cli-build] ${pkg.name} declares no licence (${relative(repo, dir)})`);
  const files = (await readdir(dir)).filter((name) => LICENCE_FILE.test(name)).sort();
  const texts = await Promise.all(files.map((name) => readFile(join(dir, name), 'utf8')));
  return { name: pkg.name, version: pkg.version, licence, text: texts.join('\n\n').trim() };
}

const dirs = [
  ...new Set(Object.keys(result.metafile.inputs).map(packageDirOf).filter(Boolean)),
].sort();
const notices = (await Promise.all(dirs.map(noticeOf))).sort((a, b) =>
  a.name.localeCompare(b.name),
);
// Third-party material vendored into our own source (Lucide and Feather geometry, ...): the licences page's table,
// matched on the repo paths the bundle took in.
const inputs = new Set(
  Object.keys(result.metafile.inputs).map((input) => relative(repo, resolve(app, input))),
);
const licences = join(repo, 'packages/licences');
const embedded = await Promise.all(
  EMBEDDED_WORKS.filter((w) =>
    'sources' in w.trigger
      ? w.trigger.sources.some((s) => inputs.has(s))
      : assetNames.some((name) => w.trigger.assets.test(name)),
  ).map(async (w) => ({
    name: `${w.name} (${w.carrier})`,
    version: w.version,
    licence: w.licence,
    text: (await Promise.all(w.texts.map((t) => readFile(join(licences, 'texts', t.file), 'utf8'))))
      .join('\n\n')
      .trim(),
  })),
);
notices.push(...embedded);
const rule = '-'.repeat(78);
await writeFile(
  join(dist, 'THIRD_PARTY_LICENSES'),
  [
    'livediagram bundles the following open-source packages. Their licences ask for these notices to travel with it.',
    ...notices.map(
      (n) =>
        `${rule}\n${n.name} ${n.version} (${n.licence})\n\n${n.text || `Licensed under ${n.licence}.`}`,
    ),
  ].join('\n\n') + '\n',
);

const source = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'));
await writeFile(
  join(dist, 'package.json'),
  `${JSON.stringify(
    {
      // Published under the workspace's own name, @livediagram/cli (CLI1); the command it installs is `livediagram`.
      name: source.name,
      version: source.version,
      description: 'Read, build, edit and discuss livediagram documents from the terminal.',
      license: 'MIT',
      type: 'module',
      bin: { livediagram: 'livediagram.mjs' },
      files: [
        'livediagram.mjs',
        ...ASSETS.map(({ to }) => to),
        'README.md',
        'LICENSE',
        'THIRD_PARTY_LICENSES',
      ],
      engines: { node: '>=22' },
      homepage: 'https://livediagram.app',
      repository: {
        type: 'git',
        url: 'git+https://github.com/livediagram-app/livediagram.app.git',
        directory: 'apps/cli',
      },
      bugs: 'https://github.com/livediagram-app/livediagram.app/issues',
      keywords: ['diagram', 'cli', 'agents', 'livediagram'],
    },
    null,
    2,
  )}\n`,
);
await mkdir(dist, { recursive: true });
await copyFile(join(repo, 'LICENSE'), join(dist, 'LICENSE'));
await copyFile(join(app, 'PACKAGE_README.md'), join(dist, 'README.md'));
console.info(
  `[cli-build] dist ready: livediagram ${source.version}, ${notices.length - embedded.length} bundled packages and ${embedded.length} embedded works noticed`,
);
