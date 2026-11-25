import { describe, expect, it } from 'vitest';
import { THEMES } from '@livedocuments/document';
import { STYLE_GUIDE_RESOURCE_URI, styleGuideDoc } from './element-docs';

// The style guide resource (docs/specs/011-theme/style-guide.md "Agents"): every theme, design and typeface named by
// its label, so an agent reads what the editor shows.
describe('the style guide resource', () => {
  it('lives at its own URI and names each part by its label', () => {
    expect(STYLE_GUIDE_RESOURCE_URI).toBe('livedocuments://guide/styles');
    const doc = styleGuideDoc();
    expect(doc).toContain(THEMES.find((t) => t.id === 'mono')!.label);
    expect(doc).toContain('Aurora');
    expect(doc).toContain('Inter');
  });
});
