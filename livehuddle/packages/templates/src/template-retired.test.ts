import { describe, expect, it } from 'vitest';
import { isRetiredElement } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { TEMPLATES } from './templates';

// docs/specs/002-project-scope/not-in-livehuddle.md "The element engine": a template makes only kinds livehuddle
// draws, never a retired one that would land as its placeholder.
describe('template output', () => {
  it('holds no retired element in any template', () => {
    const retired = TEMPLATES.flatMap((t) =>
      buildTemplate(t.kind, 0, 0)
        .filter((el) => isRetiredElement(el))
        .map((el) => `${t.kind}:${el.id}`),
    );
    expect(retired).toEqual([]);
  });
});
