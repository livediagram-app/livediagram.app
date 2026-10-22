import { expect, it } from 'vitest';
import { newUserId } from './ids.ts';

it('mints ids in the Clerk shape the apps already guard on', () => {
  const id = newUserId();
  expect(id).toMatch(/^user_[0-9a-f]{32}$/);
  expect(newUserId()).not.toBe(id);
});
