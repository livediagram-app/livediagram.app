// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { badgePresetFace, BADGE_PRESET_VARIANTS } from '@livedesign/document';
import { BadgePresetGlyph } from './BadgePresetGlyph';
import { PaletteTintProvider } from './PaletteIconButton';
import { BADGE_PRESET_TILES } from './palette-element-presets';

// docs/specs/009-elements/badge.md "Badge presets": each preset's tile is the badge it adds, its own text in its own
// look and colours, never the palette's tile fill.

afterEach(cleanup);

const fills = (svg: Element) =>
  [...svg.querySelectorAll('rect')].map((r) => r.getAttribute('fill'));

describe('BadgePresetGlyph', () => {
  it('draws the Warning as a solid rose pill reading PII in white', () => {
    const { container } = render(<BadgePresetGlyph {...badgePresetFace('warning')} />);
    const svg = container.querySelector('svg')!;
    expect(fills(svg)).toEqual(['#e11d48']);
    expect(svg.querySelector('text')!.textContent).toBe('PII');
    expect(svg.querySelector('text')!.getAttribute('fill')).toBe('#ffffff');
  });

  it('draws the Version as an outline in the accent, on the Default theme', () => {
    const { container } = render(<BadgePresetGlyph {...badgePresetFace('version')} />);
    const rect = container.querySelector('rect')!;
    expect(rect.getAttribute('stroke')).toBe('#0ea5e9');
    expect(container.querySelector('text')!.textContent).toBe('v2.1');
  });

  it('takes the theme’s accent, but never over a preset’s own colour', () => {
    const tint = { stroke: '#7c3aed', fill: '#f5f3ff', text: '#2e1065' };
    const { container } = render(
      <PaletteTintProvider tint={tint}>
        <BadgePresetGlyph {...badgePresetFace(undefined)} />
        <BadgePresetGlyph {...badgePresetFace('warning')} />
      </PaletteTintProvider>,
    );
    const [newPill, warning] = [...container.querySelectorAll('svg')];
    expect(fills(newPill!)).toEqual(['#7c3aed']);
    expect(fills(warning!)).toEqual(['#e11d48']);
  });

  it('draws every preset tile from its preset, never tinted', () => {
    expect(BADGE_PRESET_TILES).toHaveLength(BADGE_PRESET_VARIANTS.length + 1);
    for (const tile of BADGE_PRESET_TILES) {
      expect(tile.noTint).toBe(true);
      expect(tile.filled).toBeUndefined();
      const variant = tile.action.type === 'shape' ? tile.action.variant : undefined;
      const { container } = render(<>{tile.icon}</>);
      expect(container.querySelector('text')!.textContent).toBe(badgePresetFace(variant).label);
      cleanup();
    }
  });
});
