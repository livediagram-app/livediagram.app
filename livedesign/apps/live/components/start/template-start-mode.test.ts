import { describe, expect, it } from 'vitest';
import { templateStartMode } from './template-start-mode';

// docs/specs/007-editor/start-diagramming.md "When it shows"
const base = {
  hydrated: true,
  zen: false,
  embed: false,
  readOnly: false,
  drawToolArmed: false,
  mode: 'pages' as const,
  elementCount: 0,
  pages: [{}],
};

describe('templateStartMode', () => {
  it('offers Start Making Pages on an empty tab', () => {
    expect(templateStartMode(base)).toBe('pages');
    expect(templateStartMode({ ...base, pages: [] })).toBe('pages');
  });

  it('offers none once the tab has content, or its page a kind or company', () => {
    expect(templateStartMode({ ...base, elementCount: 1 })).toBeNull();
    expect(templateStartMode({ ...base, pages: [{ kind: 'logo' }] })).toBeNull();
    expect(templateStartMode({ ...base, pages: [{}, {}] })).toBeNull();
  });

  it('offers none to someone who cannot edit, nor in zen, an embed, before hydration or with a tool armed', () => {
    for (const k of ['readOnly', 'zen', 'embed', 'drawToolArmed'] as const)
      expect(templateStartMode({ ...base, [k]: true }), k).toBeNull();
    expect(templateStartMode({ ...base, hydrated: false })).toBeNull();
  });
});
