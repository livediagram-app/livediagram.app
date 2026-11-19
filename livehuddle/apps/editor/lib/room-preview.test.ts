import { describe, expect, it } from 'vitest';
import { roomPreviewSvg } from './room-preview';

// docs/specs/011-theme/canvas-and-theme-dialog.md "One dialog, this editor's profile": the Finish and Text panels
// preview a small room on the tab's floor.
const tab = { background: '#ffffff', theme: 'brand' };

describe('roomPreviewSvg', () => {
  it('draws the room and its sticky, stable, in each finish', () => {
    const svg = roomPreviewSvg('flexible', tab);
    expect(svg).toContain('Huddle');
    expect(svg).toContain('Stand-up');
    for (const finish of ['sketch', 'marker'] as const)
      expect(roomPreviewSvg(finish, tab)).toContain(`data-finish="${finish}"`);
    expect(roomPreviewSvg('sketch', tab)).toBe(roomPreviewSvg('sketch', tab));
  });

  it("lays it on the tab's floor, under its own pattern id", () => {
    const svg = roomPreviewSvg('flexible', { ...tab, floor: 'wood', floorOpacity: 0.5 });
    expect(svg).toContain('lvd-room-preview-bg');
    expect(svg).not.toContain('lvd-export-bg');
    expect(roomPreviewSvg('flexible', tab)).not.toContain('lvd-room-preview-bg');
  });

  it('letters it in the tab font and theme, at the size new text takes', () => {
    expect(roomPreviewSvg('flexible', { ...tab, font: 'lora' })).toMatch(/Lora/);
    expect(roomPreviewSvg('flexible', { ...tab, theme: 'forest' })).not.toBe(
      roomPreviewSvg('flexible', tab),
    );
    expect(roomPreviewSvg('flexible', { ...tab, textSize: 'lg' })).not.toBe(
      roomPreviewSvg('flexible', tab),
    );
    expect(
      roomPreviewSvg('flexible', { ...tab, patternColor: '#123456', floor: 'sparkles' }),
    ).toBeTruthy();
  });
});
