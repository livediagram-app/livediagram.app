import { describe, expect, it } from 'vitest';
import { isRetiredExplorerEvent } from './retired-explorer';

// docs/specs/017-telemetry/telemetry.md "Retired features": the Explorer events no app sends any more.
describe('isRetiredExplorerEvent', () => {
  it("retires Home's Landing and Nav arrivals, not the first-run Home", () => {
    expect(isRetiredExplorerEvent('Home', 'Opened', 'Landing')).toBe(true);
    expect(isRetiredExplorerEvent('Home', 'Opened', 'Nav')).toBe(true);
    expect(isRetiredExplorerEvent('Home', 'Opened', 'Welcome')).toBe(false);
    expect(isRetiredExplorerEvent('Home', 'Opened', null)).toBe(false);
  });

  it('retires the whole Timeline category and What Happened', () => {
    expect(isRetiredExplorerEvent('Timeline', 'Opened', 'Landing')).toBe(true);
    expect(isRetiredExplorerEvent('Timeline', 'Loaded', null)).toBe(true);
    expect(isRetiredExplorerEvent('Home', 'Selected', 'WhatHappened')).toBe(true);
    expect(isRetiredExplorerEvent('Page', 'View', '/explorer/timeline')).toBe(false);
  });
});
