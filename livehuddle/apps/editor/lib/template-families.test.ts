import { describe, expect, it } from 'vitest';
import { TEMPLATES, templateFamilyOf } from '@livehuddle/templates';

// The template family a template belongs to (docs/specs/013-workspace/default-folders.md "Creation
// intent"): the one map that routes a new item to its default folder. The retro formats that made up the
// Retrospectives family left livehuddle (Work Tracker #423), and the family with them (#507): a default stored
// for it reads as Spaces.

describe('templateFamilyOf', () => {
  it('reads no template as no family', () => {
    expect(templateFamilyOf(null)).toBeNull();
  });

  it('gives no template in the catalogue a family', () => {
    expect(TEMPLATES.filter((t) => templateFamilyOf(t.kind) !== null)).toEqual([]);
  });
});
