// Where a listed project belongs to the reader (docs/specs/013-workspace/explorer-structure.md#projects-in-this-browser).

import { describe, expect, it } from 'vitest';
import { isInThisBrowser } from './project-space';

describe('isInThisBrowser', () => {
  it('recognises a project saved only in this browser', () => {
    expect(isInThisBrowser({ ownerId: 'offline' })).toBe(true);
  });

  it('rejects a cloud project', () => {
    expect(isInThisBrowser({ ownerId: 'user_1' })).toBe(false);
  });
});
