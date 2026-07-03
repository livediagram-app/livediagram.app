import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '@livediagram/templates';
import { TemplatePreview } from './template-preview';

// Every catalogue entry must render a preview illustration. The
// preview groups are hand-authored switches, so a new TemplateKind
// that lands in TEMPLATES without a matching case falls through every
// group and the picker shows an empty grey tile (exactly how the
// first Technical-batch cards shipped before this test existed).
// TemplatePreview is pure render (no hooks), so calling it as a plain
// function is enough to assert the dispatch resolves.
describe('TemplatePreview', () => {
  it('returns an SVG for every template in the catalogue', () => {
    for (const template of TEMPLATES) {
      const preview = TemplatePreview({ kind: template.kind });
      expect(preview, `missing preview illustration for '${template.kind}'`).not.toBeNull();
      expect(preview?.type).toBe('svg');
    }
  });
});
