import { describe, expect, it } from 'vitest';
import { COMMUNITY_CATEGORIES } from '@livedocuments/api-schema';
import { TEMPLATE_CATEGORIES } from './template-categories';

// The Community files a post under the same categories Start With files its templates under
// (liveworkspace/docs/specs/007-community/community.md "Categories"), so Start With can show the Community's best
// beside them. The two lists live apart (the shared contract cannot import a product), so this pins them together.
describe("the Community's categories", () => {
  it('are the template categories, the same ids, labels, descriptions and order, then Something Else', () => {
    const list = COMMUNITY_CATEGORIES as readonly { id: string; label: string; blurb: string }[];
    expect(list.at(-1)!.id).toBe('other');
    expect(
      list.slice(0, -1).map(({ id, label, blurb }) => ({ id, label, description: blurb })),
    ).toEqual(
      TEMPLATE_CATEGORIES.map(({ id, label, description }) => ({ id, label, description })),
    );
  });
});
