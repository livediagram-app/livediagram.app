import { afterEach, describe, expect, it, vi } from 'vitest';
import { artApp } from './art-app';
import { appSamples } from './app-samples';
import { stickyOnly } from './primitives-canvas';

// The one help centre builds each app's help with HELP_ART_APP set from its scope; the shared art reads it to draw
// that app's canvas and words. Before it, livehuddle's help drew flowchart boxes (the env it used was no longer set).
describe('the app the art is drawn for', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is none under All Apps, and ignores a value that is not an app', () => {
    vi.stubEnv('HELP_ART_APP', '');
    expect(artApp()).toBeUndefined();
    vi.stubEnv('HELP_ART_APP', 'nope');
    expect(artApp()).toBeUndefined();
    expect(appSamples().tabs[0]).toBe('Payments');
  });

  it('makes livehuddle sticky-only and gives every app its own sample names', () => {
    vi.stubEnv('HELP_ART_APP', 'livehuddle');
    expect(stickyOnly()).toBe(true);
    expect(appSamples().work).toContain('Team Office');
    vi.stubEnv('HELP_ART_APP', 'liveplanner');
    expect(stickyOnly()).toBe(false);
    expect(appSamples().work).not.toContain('Data model');
  });
});
