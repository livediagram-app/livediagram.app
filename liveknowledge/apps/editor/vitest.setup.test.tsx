// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

// Guards the wiring in vitest.config.ts, not the library: if `setupFiles`
// ever drops `@liveworkspace/vitest-config/react-cleanup`, renders leak across
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

// Guards the other two setup files (docs/specs/003-system-architecture/testing.md "The editor's tests read dates
// as en-GB, at UTC"): without them a test that words a date passes on one machine and fails on another, by its
// locale (CI's runners are en-US) or its time zone.
describe('dates in tests', () => {
  // Half past eleven at night in UTC: already the 13th east of Greenwich, and "Nov 12" under en-US.
  const lateEvening = new Date(Date.UTC(2026, 10, 12, 23, 30));

  it('are worded in en-GB, whatever the machine’s locale', () => {
    expect(lateEvening.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })).toBe(
      '12 Nov',
    );
    expect(new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(lateEvening)).toBe(
      '12 Nov 2026',
    );
  });

  it('are read in UTC, whatever the machine’s time zone', () => {
    expect(lateEvening.getTimezoneOffset()).toBe(0);
    expect(lateEvening.getDate()).toBe(12);
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('UTC');
  });

  it('still take a locale and a zone a test asks for', () => {
    expect(
      lateEvening.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Asia/Tokyo',
      }),
    ).toBe('Nov 13');
  });
});
