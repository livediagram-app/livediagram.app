// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearQuietLanding, hasQuietLanding, markQuietLanding } from './quiet-landing';

describe('quiet landing flag (docs/specs/007-editor/new-document-route.md)', () => {
  beforeEach(() => sessionStorage.clear());

  it('is unset until /new marks it', () => {
    expect(hasQuietLanding()).toBe(false);
  });

  it('holds across reads until the editor clears it', () => {
    markQuietLanding();
    expect(hasQuietLanding()).toBe(true);
    expect(hasQuietLanding()).toBe(true);
    clearQuietLanding();
    expect(hasQuietLanding()).toBe(false);
  });
});
