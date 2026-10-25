// Writes src/lucide.generated.ts from the pinned lucide-static package and lucide-manifest.json
// (docs/specs/004-interface-design/iconography.md, "Source"). Run: `pnpm icons:vendor`.
// `--adopt-installed` first moves the manifest's pin to the installed lucide-static, for a
// Dependabot bump (.github/workflows/lucide-revendor.yml).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { lucideModule, type LucideManifest } from '../src/lucide-vendor.ts';

const require = createRequire(import.meta.url);
const manifestUrl = new URL('../lucide-manifest.json', import.meta.url);
const manifest = JSON.parse(readFileSync(manifestUrl, 'utf8')) as LucideManifest;
const installed = (require('lucide-static/package.json') as { version: string }).version;
if (installed !== manifest.version && process.argv.includes('--adopt-installed')) {
  console.log(`vendor-lucide: moving the manifest pin from ${manifest.version} to ${installed}`);
  manifest.version = installed;
  writeFileSync(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
}
if (installed !== manifest.version) {
  console.error(`vendor-lucide: manifest pins ${manifest.version} but ${installed} is installed`);
  process.exit(1);
}
const readSvg = (name: string) => {
  try {
    return readFileSync(require.resolve(`lucide-static/icons/${name}.svg`), 'utf8');
  } catch {
    throw new Error(`vendor-lucide: unknown glyph ${name}`);
  }
};
const licence = readFileSync(require.resolve('lucide-static/LICENSE'), 'utf8');
writeFileSync(
  new URL('../src/lucide.generated.ts', import.meta.url),
  lucideModule(manifest, readSvg, licence),
);
console.log(
  `vendor-lucide: wrote ${manifest.glyphs.length} glyphs from lucide-static@${manifest.version}`,
);
