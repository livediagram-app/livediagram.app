import { centreOffsetPx } from '@livediagram/icons/centring';
import { SettingsCategoryTile, SettingsUiKitProvider } from '@liveworkspace/settings-ui';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SETTINGS_TILES } from './settings-icons';
import { SETTINGS_KIT } from './settings-kit';

// Each Settings category glyph sits centred in its tile, drawn with this editor's Glyph: ink within
// 0.5px of the box centre (docs/specs/004-interface-design/iconography.md, "Guarding"). The tile
// centres the svg, so an off-centre drawing is what the optical ink audit sees.
describe('settings category glyphs', () => {
  it.each(Object.entries(SETTINGS_TILES))('%s is centred', (_id, tile) => {
    const markup = renderToStaticMarkup(
      <SettingsUiKitProvider kit={SETTINGS_KIT}>
        <SettingsCategoryTile id={tile} />
      </SettingsUiKitProvider>,
    );
    const svg = /<svg[\s\S]*<\/svg>/.exec(markup)![0];
    const units = Number(/viewBox="0 0 ([\d.]+)/.exec(svg)![1]);
    const size = Number(/width="([\d.]+)"/.exec(svg)![1]);
    const px = Number(/stroke-width="([\d.]+)"/.exec(svg)![1]);
    const off = centreOffsetPx(svg, { units, sizePx: size, strokeUnits: (px * units) / size })!;
    expect(Math.abs(off.dx)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(off.dy)).toBeLessThanOrEqual(0.5);
  });
});
