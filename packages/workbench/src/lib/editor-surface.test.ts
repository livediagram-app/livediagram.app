import { describe, expect, it } from 'vitest';
import { liveEmbedFramePath, surfaceFlags, workbenchSurfaceOf } from './editor-surface';

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

  it("reads a live embed's frame as the workbench session in the embed's look", () => {
    expect(surfaceFlags('live-embed')).toEqual({
      embedMode: true,
      workbenchMode: true,
      appChrome: false,
    });
  });
});

// The live embed frame flag (liveworkspace/docs/specs/004-index/live-embeds.md "The frame").
describe('the live embed frame flag', () => {
  it("adds the flag to a ticket's path, after its query or as one", () => {
    expect(liveEmbedFramePath('/embed/workbench?d=p1')).toBe('/embed/workbench?d=p1&live=1');
    expect(liveEmbedFramePath('/embed/workbench')).toBe('/embed/workbench?live=1');
  });

  it('reads a flagged address as a live embed, any other as a workbench', () => {
    expect(workbenchSurfaceOf('?d=p1&live=1')).toBe('live-embed');
    expect(workbenchSurfaceOf('?d=p1')).toBe('workbench');
    expect(workbenchSurfaceOf('?d=p1&live=0')).toBe('workbench');
    expect(workbenchSurfaceOf('')).toBe('workbench');
  });
});
