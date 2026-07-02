import { describe, expect, it } from 'vitest';
import type { ArrowElement, ImageElement, ShapeElement, Tab } from './index';
import { renderElementsToSvg } from './svg-render';

const shape = (id: string, o: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  ...o,
});

const image = (id: string, o: Partial<ImageElement> = {}): ImageElement => ({
  id,
  type: 'image',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  imageId: 'img1',
  ...o,
});

const pinnedArrow = (
  id: string,
  fromId: string,
  toId: string,
  o: Partial<ArrowElement> = {},
): ArrowElement => ({
  id,
  type: 'arrow',
  from: { kind: 'pinned', elementId: fromId, anchor: 'e' },
  to: { kind: 'pinned', elementId: toId, anchor: 'w' },
  ...o,
});

const tab = (elements: Tab['elements'], o: Partial<Tab> = {}): Tab => ({
  id: 't',
  name: 'T',
  elements,
  ...o,
});

describe('renderElementsToSvg', () => {
  it('renders a self-contained SVG with shapes, an arrow and a background', () => {
    const svg = renderElementsToSvg(
      tab([shape('a'), shape('b', { x: 200 }), pinnedArrow('arr', 'a', 'b')]),
    );
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('<rect'); // shape bodies + background
    expect(svg).toContain('<path'); // the arrow
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('wraps a long label headlessly (no DOM canvas needed)', () => {
    const svg = renderElementsToSvg(
      tab([shape('a', { label: 'one two three four five six seven eight nine', width: 80 })]),
    );
    // The char-width fallback measure kicks in without a document, so a long
    // label still wraps to multiple <tspan> lines rather than one overflowing run.
    expect((svg.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
  });

  it('sizes the viewBox to the content bounds plus padding', () => {
    const svg = renderElementsToSvg(tab([shape('a', { x: 10, y: 20, width: 100, height: 80 })]), {
      padding: 32,
    });
    // bounds (10,20,100,80) inflated by 32 each side -> -22 -12 164 144.
    expect(svg).toContain('viewBox="-22 -12 164 144"');
  });

  it('honours an explicit background colour', () => {
    const svg = renderElementsToSvg(tab([shape('a')], { backgroundColor: '#abcdef' }));
    expect(svg).toContain('#abcdef');
  });

  it('defaults an empty tab to a standard page rather than a 0x0 frame', () => {
    const svg = renderElementsToSvg(tab([]));
    expect(svg).toContain('viewBox="-32 -32 664 464"');
  });

  describe('image elements', () => {
    it('draws a dashed placeholder + alt label when no bytes are resolved', () => {
      const svg = renderElementsToSvg(tab([image('i', { alt: 'A photo' })]));
      expect(svg).toContain('stroke-dasharray="4 4"');
      expect(svg).toContain('A photo');
      expect(svg).not.toContain('<image');
    });

    it('embeds the bitmap as an <image> when a data URL is resolved', () => {
      const href = 'data:image/png;base64,AAAA';
      const svg = renderElementsToSvg(tab([image('i', { alt: 'A photo' })]), {
        resolveImageHref: (id) => (id === 'img1' ? href : undefined),
      });
      expect(svg).toContain(`<image`);
      expect(svg).toContain(`href="${href}"`);
      // contain (the default) letterboxes via meet; no placeholder / alt text.
      expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
      expect(svg).toContain('clip-path="url(#lvd-img-i)"');
      expect(svg).not.toContain('stroke-dasharray="4 4"');
      expect(svg).not.toContain('A photo');
    });

    it("uses slice for objectFit 'cover'", () => {
      const svg = renderElementsToSvg(tab([image('i', { objectFit: 'cover' })]), {
        resolveImageHref: () => 'data:image/png;base64,AAAA',
      });
      expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
    });

    it("clips a 'full'-radius avatar to a circle (rx = half the shorter side)", () => {
      const svg = renderElementsToSvg(
        tab([image('i', { width: 100, height: 80, borderRadius: 'full' })]),
        { resolveImageHref: () => 'data:image/png;base64,AAAA' },
      );
      // min(width/2, height/2) = 40.
      expect(svg).toContain('rx="40" ry="40"');
    });
  });

  describe('icon elements', () => {
    const icon = (o: Partial<ShapeElement> = {}) =>
      shape('ic', { shape: 'icon', iconId: 'server', width: 48, height: 48, ...o });

    it('renders resolved line art as a nested svg tinted by the element stroke', () => {
      const svg = renderElementsToSvg(tab([icon({ strokeColor: '#123456' })]), {
        resolveIconArt: () => ({ markup: '<path d="M1 2"/>', colored: false }),
      });
      expect(svg).toContain('<path d="M1 2"/>');
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('stroke="#123456"');
      // 48px box over a 24-unit viewBox = 2x scale, so the 2px on-screen
      // stroke exports as 1 glyph unit.
      expect(svg).toContain('stroke-width="1"');
    });

    it('pins a captioned glyph to the top band (24x40 viewBox) with a bottom label', () => {
      const svg = renderElementsToSvg(tab([icon({ label: 'API' })]), {
        resolveIconArt: () => ({ markup: '<path d="M1 2"/>', colored: false }),
      });
      expect(svg).toContain('viewBox="0 0 24 40"');
      expect(svg).toContain('>API</');
    });

    it('renders a colored (Technology) mark without recolouring it', () => {
      const svg = renderElementsToSvg(tab([icon({ strokeColor: '#123456' })]), {
        resolveIconArt: () => ({ markup: '<rect fill="#ED7100"/>', colored: true }),
      });
      expect(svg).toContain('<rect fill="#ED7100"/>');
      // No stroke wrapper: the mark is self-coloured.
      expect(svg).not.toContain('stroke="#123456"');
    });

    it('draws a Technology mark at its fixed preset size, centred (spec/41)', () => {
      const art = () => ({ markup: '<circle/>', colored: true });
      // Default preset (md = 48px) in a 200x100 box, no label: centred.
      const svg = renderElementsToSvg(tab([icon({ width: 200, height: 100 })]), {
        resolveIconArt: art,
      });
      expect(svg).toContain('width="48" height="48"');
      expect(svg).toContain('x="76" y="26"'); // (200-48)/2, (100-48)/2
      // Explicit xl preset (96px) clamps to a smaller box.
      const clamped = renderElementsToSvg(tab([icon({ width: 60, height: 60, iconSize: 'xl' })]), {
        resolveIconArt: art,
      });
      expect(clamped).toContain('width="60" height="60" viewBox="0 0 24 24"');
    });

    it('sends a top-captioned Technology mark to the bottom band (spec/41)', () => {
      const art = () => ({ markup: '<circle/>', colored: true });
      const svg = renderElementsToSvg(
        tab([icon({ width: 100, height: 100, label: 'EC2', textAlignY: 'top' })]),
        { resolveIconArt: art },
      );
      // Band y0 = 36% of 100; the 48px mark centres inside the 58% band.
      expect(svg).toContain('x="26" y="41" width="48" height="48"');
      // The caption sits near the top instead of the floor.
      expect(svg).toContain('y="14"'); // el.y + fontSize (default 14)
    });

    it('falls back to the box-with-label output without a resolver', () => {
      const svg = renderElementsToSvg(tab([icon({ label: 'Server' })]));
      expect(svg).toContain('<rect'); // the generic body
      expect(svg).toContain('>Server</');
      expect(svg).not.toContain('viewBox="0 0 24');
    });
  });
});
