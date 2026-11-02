import { describe, expect, it } from 'vitest';
import { surfaceFlags } from './editor-surface';

// The editor's surface (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a
// workbench"): where it runs decides which gates apply.
describe('surfaceFlags', () => {
  it('reads the app as the full chrome', () => {
    expect(surfaceFlags('app')).toEqual({
      embedMode: false,
      workbenchMode: false,
      appChrome: true,
    });
  });

  it('reads a share-code embed as an embed', () => {
    expect(surfaceFlags('embed')).toEqual({
      embedMode: true,
      workbenchMode: false,
      appChrome: false,
    });
  });

  it('reads a workbench as its own surface, neither the app nor an embed', () => {
    expect(surfaceFlags('workbench')).toEqual({
      embedMode: false,
      workbenchMode: true,
      appChrome: false,
    });
  });
});
