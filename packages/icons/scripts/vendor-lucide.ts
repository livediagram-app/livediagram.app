// Writes src/lucide/ (one module per glyph) and src/lucide.generated.ts (their re-exports) from the pinned
// lucide-static package and lucide-manifest.json (docs/specs/004-interface-design/iconography.md, "Source").
// Run: `pnpm icons:vendor`. `--adopt-installed` first moves the manifest's pin to the installed lucide-static,
// for a Dependabot bump (.github/workflows/lucide-revendor.yml).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { LUCIDE_DIR, lucideModules, type LucideManifest } from '../src/lucide-vendor.ts';

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
const src = new URL('../src/', import.meta.url);
// A glyph dropped from the manifest leaves no module behind.
rmSync(new URL(`${LUCIDE_DIR}/`, src), { recursive: true, force: true });
mkdirSync(new URL(`${LUCIDE_DIR}/`, src), { recursive: true });
for (const [path, text] of lucideModules(manifest, readSvg, licence)) {
  writeFileSync(new URL(path, src), text);
}
console.log(
  `vendor-lucide: wrote ${manifest.glyphs.length} glyphs from lucide-static@${manifest.version}`,
);
