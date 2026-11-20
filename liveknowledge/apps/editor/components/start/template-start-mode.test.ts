import { describe, expect, it } from 'vitest';
import { showsTemplateStart } from './template-start-mode';

// docs/specs/007-editor/start-diagramming.md "When it shows"
const base = {
  hydrated: true,
  zen: false,
  embed: false,
  readOnly: false,
  drawToolArmed: false,
  elementCount: 0,
  pages: [{}],
};

describe('showsTemplateStart', () => {
  it('offers Start Making Pages on an empty tab', () => {
    expect(showsTemplateStart(base)).toBe(true);
    expect(showsTemplateStart({ ...base, pages: [] })).toBe(true);
  });

  it('offers none once the tab has content, or its page a kind or company', () => {
    expect(showsTemplateStart({ ...base, elementCount: 1 })).toBe(false);
    expect(showsTemplateStart({ ...base, pages: [{ kind: 'article' }] })).toBe(false);
    expect(showsTemplateStart({ ...base, pages: [{}, {}] })).toBe(false);
  });

  it('offers none to someone who cannot edit, nor in zen, an embed, before hydration or with a tool armed', () => {
    for (const k of ['readOnly', 'zen', 'embed', 'drawToolArmed'] as const)
      expect(showsTemplateStart({ ...base, [k]: true }), k).toBe(false);
    expect(showsTemplateStart({ ...base, hydrated: false })).toBe(false);
  });
});
