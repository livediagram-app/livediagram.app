import { describe, expect, it } from 'vitest';
import { ELEMENT_TOUR_STEP_SOURCE, ELEMENT_TOUR_TOKENS } from './computed-emitters';
import { ELEMENT_TOUR_KINDS } from './element-tour-kinds';

// Element tours (docs/specs/007-editor/element-tours.md): the dashboard charts every tour the editor registers, and
// reads every tour's steps.
describe('element tour tokens', () => {
  it('match the editor registry, kind for kind', () => {
    expect(ELEMENT_TOUR_KINDS.map((k) => k.token)).toEqual(ELEMENT_TOUR_TOKENS);
  });

  it('read steps for every tour', () => {
    for (const token of ELEMENT_TOUR_TOKENS)
      expect(
        ELEMENT_TOUR_STEP_SOURCE.some((s) => s.startsWith(`${token}Step`)),
        token,
      ).toBe(true);
  });
});
