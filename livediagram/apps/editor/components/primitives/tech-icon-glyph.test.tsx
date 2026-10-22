// @vitest-environment jsdom
// A Technology tile's white glyph draws the chrome weight for the tile's rendered
// size (docs/specs/004-interface-design/iconography.md, "Technology tiles"), with the
// same stroke the export writes (svgIconShape), so the editor and the export match.
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { techGlyphStrokeUnits } from '@livediagram/icons';

import { ensureIconCatalogs } from '@/lib/icon-registry';
import { TechIconArt, TechIconGlyph } from './tech-icon-glyph';

beforeAll(async () => {
  await ensureIconCatalogs();
});

afterEach(cleanup);

const glyphGroup = (container: HTMLElement) => container.querySelector('g[stroke="#fff"]');

describe('TechIconGlyph', () => {
  it('strokes the glyph for its preset size, scaling with the tile', () => {
    const { container } = render(<TechIconGlyph iconId="aws-s3" size="xl" />);
    const g = glyphGroup(container);
    expect(g?.getAttribute('stroke-width')).toBe(String(techGlyphStrokeUnits(96)));
    // The tile is one picture: its glyph scales with it at any zoom, like the export.
    expect(g?.getAttribute('vector-effect')).toBeNull();
  });

  it('uses the default preset when none is set', () => {
    const { container } = render(<TechIconGlyph iconId="aws-s3" />);
    expect(glyphGroup(container)?.getAttribute('stroke-width')).toBe(
      String(techGlyphStrokeUnits(48)),
    );
  });
});

describe('TechIconArt', () => {
  it('strokes a palette thumbnail for its own size', () => {
    const { container } = render(
      <svg viewBox="0 0 24 24">
        <TechIconArt iconId="aws-s3" sizePx={18} />
      </svg>,
    );
    expect(glyphGroup(container)?.getAttribute('stroke-width')).toBe(
      String(techGlyphStrokeUnits(18)),
    );
  });
});
