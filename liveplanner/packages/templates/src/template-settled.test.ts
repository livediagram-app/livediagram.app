import { describe, expect, it } from 'vitest';
import { settleChips, type Element } from '@liveplanner/project';
import { buildTemplate } from './build-template';
import { TEMPLATES } from './templates';

// docs/specs/009-elements/blueprints/badge.md "Settling": a template lands settled, its step numbers half
// their disc and its badges fitted, exactly as a stored board reads back, so a preview or an agent's create shows what
// the editor will.
const settled = (els: Element[]) => settleChips([], els, { attachLoose: false });

describe('template output', () => {
  it('is settled for every template', () => {
    const unsettled = TEMPLATES.map((t) => t.kind).filter((kind) => {
      const els = buildTemplate(kind, 0, 0);
      return settled(els) !== els;
    });
    expect(unsettled).toEqual([]);
  });
});
