// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// Guards the wiring in vitest.config.ts, not the library: if `setupFiles`
// ever drops `@livediagram/vitest-config/react-cleanup`, renders leak across
// tests again and React work scheduled on an orphaned root wakes after the
// jsdom teardown. That failure is a load-dependent CI flake; this is the
// cheap deterministic version of it.
describe('DOM cleanup between tests', () => {
  it('mounts something and deliberately never unmounts it', () => {
    render(<p data-testid="leaked">still here?</p>);
    expect(document.querySelector('[data-testid="leaked"]')).not.toBeNull();
  });

  it('starts the next test with an empty document', () => {
    expect(document.body.innerHTML).toBe('');
  });
});
