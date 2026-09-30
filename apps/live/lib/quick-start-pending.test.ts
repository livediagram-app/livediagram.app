// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { consumeQuickStartPending, markQuickStartPending } from './quick-start-pending';

describe('quick-start handoff flag (docs/specs/007-editor/new-document-route.md)', () => {
  beforeEach(() => sessionStorage.clear());

  it('is unset until /new marks it', () => {
    expect(consumeQuickStartPending()).toBe(false);
  });

  it('is consumed by the first read, so a reload lands on the plain canvas', () => {
    markQuickStartPending();
    expect(consumeQuickStartPending()).toBe(true);
    expect(consumeQuickStartPending()).toBe(false);
  });
});
