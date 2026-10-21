import { describe, expect, it } from 'vitest';
import { ADDER_KEY_LENGTH } from '@livediagram/document';
import { adderKeyFor } from './adder-key';

describe('adderKeyFor', () => {
  it('is stable per person and document, and differs across either', async () => {
    const a = await adderKeyFor('doc-1', 'guest-1');
    expect(a).toHaveLength(ADDER_KEY_LENGTH);
    expect(a).toMatch(/^[0-9a-f]+$/);
    expect(await adderKeyFor('doc-1', 'guest-1')).toBe(a);
    expect(await adderKeyFor('doc-2', 'guest-1')).not.toBe(a);
    expect(await adderKeyFor('doc-1', 'guest-2')).not.toBe(a);
  });

  it('never contains the owner id', async () => {
    expect(await adderKeyFor('doc-1', 'user_abc')).not.toContain('user_abc');
  });
});
