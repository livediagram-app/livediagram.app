import { describe, expect, it } from 'vitest';
import { documentIsPublic } from './community-public';

describe('documentIsPublic', () => {
  it('is public for the owner only while their post is listed and the Community is on', () => {
    expect(
      documentIsPublic({ communityOn: true, ownPostState: 'listed', communitySession: false }),
    ).toBe(true);
    expect(
      documentIsPublic({ communityOn: false, ownPostState: 'listed', communitySession: false }),
    ).toBe(false);
    expect(
      documentIsPublic({ communityOn: true, ownPostState: 'hidden', communitySession: false }),
    ).toBe(false);
    expect(
      documentIsPublic({ communityOn: true, ownPostState: null, communitySession: false }),
    ).toBe(false);
  });

  it("is public for a visitor who came in through the post's link", () => {
    expect(
      documentIsPublic({ communityOn: false, ownPostState: null, communitySession: true }),
    ).toBe(true);
  });
});
