import { describe, expect, it } from 'vitest';
import { personTagFor } from './person-tag';

describe('personTagFor', () => {
  it('is a stable hex digest of the document and the owner, never the owner id', async () => {
    const tag = await personTagFor('d1', 'user_webber');
    expect(tag).toMatch(/^[0-9a-f]{64}$/);
    expect(tag).toBe(await personTagFor('d1', 'user_webber'));
    expect(tag).not.toContain('user_webber');
  });

  it('differs per document and per owner', async () => {
    const tag = await personTagFor('d1', 'user_webber');
    expect(await personTagFor('d2', 'user_webber')).not.toBe(tag);
    expect(await personTagFor('d1', 'user_bea')).not.toBe(tag);
  });
});
