import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import { publishLimitOf, publishLimitSentence } from './publish-limit';

// Public Knowledgebases (docs/specs/030-knowledgebase/publishing.md "What the dialog shows"): the refusal's numbers
// and the notice's words.

describe('publishLimitOf', () => {
  it('reads a refused publish’s numbers', () => {
    const body = { error: 'publish_limit_reached', limit: 'publicKnowledgebases', used: 1, max: 1 };
    expect(publishLimitOf(new ApiError('publish', 409, 'publish_limit_reached', body))).toEqual({
      used: 1,
      max: 1,
      guest: false,
    });
    expect(
      publishLimitOf(
        new ApiError('publish', 409, 'publish_limit_reached', { ...body, guest: true }),
      ),
    ).toMatchObject({ guest: true });
  });

  it('is null for any other failure, or one with no numbers', () => {
    expect(publishLimitOf(new Error('no'))).toBeNull();
    expect(publishLimitOf(new ApiError('publish', 409, 'address_taken', {}))).toBeNull();
    expect(publishLimitOf(new ApiError('publish', 409, 'publish_limit_reached'))).toBeNull();
    expect(
      publishLimitOf(new ApiError('publish', 409, 'publish_limit_reached', { used: 1 })),
    ).toBeNull();
  });
});

describe('publishLimitSentence', () => {
  it('words Free’s limit with the offer, and without it', () => {
    expect(publishLimitSentence(1, 'pro')).toBe(
      'You have 1 public Knowledgebase, the most Free publishes. Unpublish one to publish this, or publish up to 10 with Pro.',
    );
    expect(publishLimitSentence(1, null)).toBe(
      'You have 1 public Knowledgebase, the most Free publishes. Unpublish one to publish this.',
    );
    expect(publishLimitSentence(1, 'team')).toBe(
      'You have 1 public Knowledgebase, the most Free publishes. Unpublish one to publish this, or publish as many as you like with Pro for Teams.',
    );
  });

  it('words Pro’s limit, with nothing more to offer on Pro, and a figure no tier has', () => {
    expect(publishLimitSentence(10, 'pro')).toBe(
      'You have 10 public Knowledgebases, the most Pro publishes. Unpublish one to publish this.',
    );
    expect(publishLimitSentence(3, null)).toBe(
      'You have 3 public Knowledgebases, the most it publishes. Unpublish one to publish this.',
    );
  });
});
