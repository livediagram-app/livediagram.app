import { describe, expect, it } from 'vitest';
import { requestStartCategory, takeStartCategory } from './start-request';

describe('start category request', () => {
  it('is taken once, then reads as none', () => {
    expect(takeStartCategory()).toBeNull();
    requestStartCategory('sheets');
    expect(takeStartCategory()).toBe('sheets');
    expect(takeStartCategory()).toBeNull();
  });
});
