import { describe, expect, it } from 'vitest';
import {
  TARGET_AMBIGUOUS_ERROR,
  TARGET_NOT_FOUND_ERROR,
} from '@liveworkspace/api-schema/ref-errors';
import { EDIT_REJECTION_CODES } from './changesets';

// The ref errors are liveworkspace's (@liveworkspace/api-schema/ref-errors); this product's edit
// operations must refuse a target with the same two codes.
describe('ref errors', () => {
  it('share the edit-operation rejection codes', () => {
    expect(EDIT_REJECTION_CODES).toContain(TARGET_NOT_FOUND_ERROR);
    expect(EDIT_REJECTION_CODES).toContain(TARGET_AMBIGUOUS_ERROR);
  });
});
