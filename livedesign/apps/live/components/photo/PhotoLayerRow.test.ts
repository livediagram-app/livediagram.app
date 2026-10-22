// docs/specs/031-photo/photo-layers.md "The Layers tab": a row's line, and its menu read as the app's verb menus.
import { describe, expect, it } from 'vitest';
import { pixelLayer } from '@/lib/photo-editor/photo-test-utils';
import { describeLayer, ROW_MENU } from './PhotoLayerRow';

describe('a layer row', () => {
  it('says what the layer is, and its blend and opacity when not the usual', () => {
    expect(describeLayer(pixelLayer('a'), 100, true)).toBe('Pixel layer');
    expect(describeLayer({ ...pixelLayer('a'), blend: 'multiply' }, 60, false)).toBe(
      'Pixel layer · Multiply · 60% · Hidden',
    );
  });
  it('gives every verb an icon and keeps Delete Layer last, on its own', () => {
    expect(ROW_MENU.every((m) => typeof m.icon === 'function')).toBe(true);
    const last = ROW_MENU.at(-1)!;
    expect(last.label).toBe('Delete Layer');
    expect(ROW_MENU.filter((m) => m.section === last.section)).toHaveLength(1);
  });
});
