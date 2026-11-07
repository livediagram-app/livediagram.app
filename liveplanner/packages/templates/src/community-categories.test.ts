// liveplanner's Community categories are its Start With template categories (docs/specs/025-community/community.md
// "Categories"), so a shared plan is found beside the templates for the same job, plus Something Else. The list itself
// is the platform's (@liveworkspace/community, re-exported by @liveplanner/api-schema); this pins it to
// TEMPLATE_CATEGORIES so neither can change without the other.
import { COMMUNITY_CATEGORIES } from '@liveplanner/api-schema';
import { describe, expect, it } from 'vitest';
import { TEMPLATE_CATEGORIES } from './template-categories';

describe('Community categories', () => {
  const shared = COMMUNITY_CATEGORIES.filter((c) => c.id !== 'other');

  const byId = <T extends { id: string }>(list: readonly T[]) =>
    [...list].sort((a, b) => a.id.localeCompare(b.id));

  it('are the template categories, with the same ids, labels and descriptions', () => {
    expect(byId(shared).map(({ id, label, blurb }) => ({ id, label, description: blurb }))).toEqual(
      byId(TEMPLATE_CATEGORIES).map(({ id, label, description }) => ({ id, label, description })),
    );
  });

  it('end with Something Else', () => {
    expect(COMMUNITY_CATEGORIES.at(-1)).toMatchObject({ id: 'other', label: 'Something Else' });
  });
});
