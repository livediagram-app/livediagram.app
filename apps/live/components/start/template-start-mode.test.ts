import { describe, expect, it } from 'vitest';
import { templateStartMode } from './template-start-mode';

// docs/specs/007-editor/start-diagramming.md "When it shows"
const base = {
  hydrated: true,
  zen: false,
  embed: false,
  readOnly: false,
  quickStartOpen: false,
  drawToolArmed: false,
  mode: 'diagram' as const,
  elementCount: 0,
  pages: [],
};

describe('templateStartMode', () => {
  it('offers each mode with templates its own start on an empty tab', () => {
    expect(templateStartMode(base)).toBe('diagram');
    expect(templateStartMode({ ...base, mode: 'facilitate' })).toBe('facilitate');
    expect(templateStartMode({ ...base, mode: 'illustrate', pages: [{}] })).toBe('illustrate');
  });

  it('offers Start Drawing with the pen in hand, and none in Plan (Start Planning is its own)', () => {
    expect(templateStartMode({ ...base, mode: 'draw', drawToolArmed: true })).toBe('draw');
    expect(templateStartMode({ ...base, mode: 'plan' })).toBeNull();
  });

  it('offers none once the tab has content, or its Illustrate page a kind or company', () => {
    expect(templateStartMode({ ...base, elementCount: 1 })).toBeNull();
    expect(
      templateStartMode({ ...base, mode: 'illustrate', pages: [{ kind: 'article' }] }),
    ).toBeNull();
    expect(templateStartMode({ ...base, mode: 'illustrate', pages: [{}, {}] })).toBeNull();
  });

  it('offers none to someone who cannot edit, nor in zen, an embed, under the Quick Start or with a tool armed', () => {
    for (const k of ['readOnly', 'zen', 'embed', 'quickStartOpen', 'drawToolArmed'] as const)
      expect(templateStartMode({ ...base, [k]: true }), k).toBeNull();
    expect(templateStartMode({ ...base, hydrated: false })).toBeNull();
  });
});
