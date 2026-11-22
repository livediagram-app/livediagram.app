import { describe, expect, it } from 'vitest';
import { showsTemplateStart } from './template-start-mode';

// docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen"
const base = {
  hydrated: true,
  zen: false,
  embed: false,
  readOnly: false,
  drawToolArmed: false,
  elementCount: 0,
  untouchedPage: true,
};

describe('showsTemplateStart', () => {
  it('may show on a new knowledgebase page with nothing written', () => {
    expect(showsTemplateStart(base)).toBe(true);
  });

  it('shows none once the page has writing or elements', () => {
    expect(showsTemplateStart({ ...base, untouchedPage: false })).toBe(false);
    expect(showsTemplateStart({ ...base, elementCount: 1 })).toBe(false);
  });

  it('shows none to someone who cannot edit, nor in zen, an embed, before hydration or with a tool armed', () => {
    for (const k of ['readOnly', 'zen', 'embed', 'drawToolArmed'] as const)
      expect(showsTemplateStart({ ...base, [k]: true }), k).toBe(false);
    expect(showsTemplateStart({ ...base, hydrated: false })).toBe(false);
  });
});
