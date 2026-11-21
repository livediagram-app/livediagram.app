// The words of Publish to the Web (docs/specs/030-knowledgebase/publishing.md "The dialog").
import { describe, expect, it } from 'vitest';
import { ApiError } from '@liveworkspace/workbench/lib/api/api-error';
import {
  addressProblem,
  privateCountText,
  publicCountText,
  publishFailureText,
  publishedOnText,
  typedAddress,
} from './publish-words';

const refused = (code: string | null, status = 409) => new ApiError('publish', status, code);

describe('publish words', () => {
  it('words every refusal, and a fault by what was asked', () => {
    expect(publishFailureText(refused('address_taken'), 'publish')).toContain(
      'Another knowledgebase',
    );
    expect(publishFailureText(refused('address_reserved', 400), 'publish')).toContain(
      'kept for liveknowledge',
    );
    expect(publishFailureText(refused('invalid_address', 400), 'publish')).toContain('Use 3 to 48');
    expect(publishFailureText(refused('nothing_to_publish'), 'publish')).toContain('No page here');
    expect(publishFailureText(refused('invalid_root', 400), 'publish')).toContain('no longer');
    expect(publishFailureText(refused('publishing_unavailable', 403), 'publish')).toContain(
      "isn't available",
    );
    expect(publishFailureText(refused('sign_in_required', 403), 'publish')).toBe(
      'Sign in to publish this knowledgebase.',
    );
    for (const code of ['forbidden', 'needs_a_person'])
      expect(publishFailureText(refused(code, 403), 'publish')).toContain('Only an Editor');
    expect(publishFailureText(refused(null, 429), 'publish')).toContain('Too many changes');
    expect(publishFailureText(refused(null, 500), 'read')).toContain("couldn't be read");
    expect(publishFailureText(new Error('x'), 'unpublish')).toContain("couldn't be unpublished");
    expect(publishFailureText(new Error('x'), 'publish')).toContain("couldn't be published");
  });

  it('checks an address', () => {
    expect(addressProblem('acme-help')).toBeNull();
    expect(addressProblem('')).toContain('Use 3 to 48');
    expect(addressProblem('ab')).toBe('An address is at least 3 characters.');
    expect(addressProblem('kb')).toBe('An address is at least 3 characters.');
    expect(addressProblem('www')).toContain('kept for liveknowledge');
    expect(typedAddress('Acme Help Centre')).toBe('acme-help-centre');
    expect(typedAddress('x'.repeat(60))).toHaveLength(48);
  });

  it('counts pages and words a date', () => {
    expect(publicCountText(1)).toBe('1 page goes public');
    expect(publicCountText(3)).toBe('3 pages go public');
    expect(privateCountText(1)).toBe('1 page stays private');
    expect(privateCountText(2)).toBe('2 pages stay private');
    expect(publishedOnText(Date.UTC(2026, 10, 21, 12), 'en-GB')).toBe('Published 21 November 2026');
  });
});
