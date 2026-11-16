import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VECTOR_EXPORT_OVERRIDES } from './tables.ts';
import { TEXTS_DIR } from './texts.ts';

// liveworkspace/docs/specs/013-export/blueprints/vector-pdf.md "Assets and external resources": the PDF writer's
// fontkit ships no licence file, so every product lists these texts for it and its two dependencies.
describe('VECTOR_EXPORT_OVERRIDES', () => {
  const writer = JSON.parse(
    readFileSync(new URL('../../vector-export/package.json', import.meta.url), 'utf8'),
  ) as { dependencies: Record<string, string> };

  it('covers the fontkit the writer pins, with its dfa and brotli', () => {
    expect(VECTOR_EXPORT_OVERRIDES.map((o) => o.package)).toEqual(['fontkit', 'dfa', 'brotli']);
    expect(VECTOR_EXPORT_OVERRIDES[0]!.version).toBe(writer.dependencies.fontkit);
  });

  it('names texts that are in the pool', () => {
    const pool = new Set(readdirSync(TEXTS_DIR));
    for (const o of VECTOR_EXPORT_OVERRIDES)
      for (const t of o.texts) if ('file' in t) expect(pool.has(t.file), t.file).toBe(true);
  });
});
