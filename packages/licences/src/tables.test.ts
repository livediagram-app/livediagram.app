import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isLicenceFile } from './licence-files.ts';
import { VECTOR_EXPORT_OVERRIDES } from './tables.ts';
import { TEXTS_DIR } from './texts.ts';

// liveworkspace/docs/specs/013-export/blueprints/vector-pdf.md "Assets and external resources": the PDF writer's
// fontkit ships its LICENSE, but its dfa and brotli ship none, so every product lists these texts for them.
describe('VECTOR_EXPORT_OVERRIDES', () => {
  const writer = fileURLToPath(new URL('../../vector-export/', import.meta.url));
  // pnpm puts a package's dependencies beside it, in the same node_modules.
  const fontkitDir = realpathSync(join(writer, 'node_modules/fontkit'));
  const manifest = (dir: string) =>
    JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      version: string;
      dependencies: Record<string, string>;
    };
  const fontkit = manifest(fontkitDir);

  it('covers the dfa and brotli the writer’s fontkit installs', () => {
    expect(manifest(writer).dependencies.fontkit).toBe(fontkit.version);
    expect(VECTOR_EXPORT_OVERRIDES.map((o) => o.package)).toEqual(['dfa', 'brotli']);
    for (const o of VECTOR_EXPORT_OVERRIDES) {
      expect(fontkit.dependencies[o.package], o.package).toBeDefined();
      expect(manifest(join(fontkitDir, '..', o.package)).version, o.package).toBe(o.version);
    }
  });

  it('needs no text for fontkit itself, which ships its licence file', () => {
    expect(readdirSync(fontkitDir).filter(isLicenceFile)).not.toEqual([]);
  });

  it('names texts that are in the pool', () => {
    const pool = new Set(readdirSync(TEXTS_DIR));
    for (const o of VECTOR_EXPORT_OVERRIDES)
      for (const t of o.texts) if ('file' in t) expect(pool.has(t.file), t.file).toBe(true);
  });
});
