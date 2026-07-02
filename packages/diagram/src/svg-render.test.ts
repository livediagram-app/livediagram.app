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

  describe('tables (spec/09)', () => {
    const table = (o: Record<string, unknown> = {}) =>
      ({
        id: 'tb',
        type: 'table',
        x: 0,
        y: 0,
        width: 300,
        height: 90,
        cells: [
          ['Name', 'Role'],
          ['Ada', 'Engineer'],
          ['Mary', 'Scientist'],
        ],
        ...o,
      }) as Tab['elements'][number];

    it('renders the real grid: cell text, dividers, and the outer frame', () => {
      const svg = renderElementsToSvg(tab([table()]));
      expect(svg).toContain('>Ada</');
      expect(svg).toContain('>Scientist</');
      // One vertical divider (x=150) + two horizontal (y=30, 60) + frame.
      expect(svg).toContain('x1="150"');
      expect(svg).toContain('y1="30"');
      expect(svg).toContain('y1="60"');
    });

    it('tints the header band and honours pinned column widths', () => {
      const svg = renderElementsToSvg(tab([table({ headerRow: true, colWidths: [100, null] })]));
      // Header wash: stroke-coloured rect at 18% over the first row.
      expect(svg).toContain('opacity="0.18"');
      // Pinned first column: the divider sits at x=100, not the even 150.
      expect(svg).toContain('x1="100"');
    });
  });

  describe('freehand + silhouettes + rotation', () => {
    it('renders a freehand sketch as its polyline, not a box', () => {
      const el = {
        id: 'fh',
        type: 'freehand',
        x: 10,
        y: 10,
        width: 100,
        height: 100,
        closed: false,
        points: [
          { nx: 0, ny: 0 },
          { nx: 1, ny: 0.5 },
        ],
        strokeColor: '#333333',
      } as Tab['elements'][number];
      const svg = renderElementsToSvg(tab([el]));
      expect(svg).toContain('M 10 10 L 110 60');
      expect(svg).not.toContain('rx="6"');
    });

    it('renders a hexagon silhouette instead of a rectangle', () => {
      const svg = renderElementsToSvg(tab([shape('h', { shape: 'hexagon' })]));
      expect(svg).toContain('polygon points="25,0 75,0 100,50 75,100 25,100 0,50"');
      expect(svg).toContain('preserveAspectRatio="none"');
    });

    it('renders a frame as outline only (contents show through)', () => {
      const svg = renderElementsToSvg(tab([shape('f', { shape: 'frame' })]));
      expect(svg).toContain('fill="none"');
    });

    it('applies element rotation about the centre', () => {
      const svg = renderElementsToSvg(tab([shape('r', { rotation: 45 })]));
      expect(svg).toContain('transform="rotate(45 50 40)"');
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

    it('scales a captioned glyph into the band opposite the label (spec/41 bands)', () => {
      // Bottom caption (the default): the glyph band is the top 6%..64% of
      // the 48px box — y = 48*0.06, height = 48*0.58.
      const svg = renderElementsToSvg(tab([icon({ label: 'API' })]), {
        resolveIconArt: () => ({ markup: '<path d="M1 2"/>', colored: false }),
      });
      expect(svg).toContain('y="2.88"');
      expect(svg).toContain('height="27.84"');
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('>API</');
      // Top caption: the glyph flips to the bottom band (y = 48*0.36).
      const flipped = renderElementsToSvg(tab([icon({ label: 'API', textAlignY: 'top' })]), {
        resolveIconArt: () => ({ markup: '<path d="M1 2"/>', colored: false }),
      });
      expect(flipped).toContain('y="17.28"');
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

    it('sends a left-captioned mark to the right half, on the caption row (spec/41)', () => {
      const art = () => ({ markup: '<circle/>', colored: true });
      const svg = renderElementsToSvg(
        tab([
          icon({
            width: 200,
            height: 100,
            label: 'EC2',
            textAlignX: 'left',
            textAlignY: 'middle',
          }),
        ]),
        { resolveIconArt: art },
      );
      // Right half band x 100..188 (44% wide from 50%), full height (middle
      // row): the 48px mark centres at (120, 26).
      expect(svg).toContain('x="120" y="26" width="48" height="48"');
      // Caption anchors left, vertically centred.
      expect(svg).toContain('text-anchor="start"');
    });

    it('falls back to the box-with-label output without a resolver', () => {
      const svg = renderElementsToSvg(tab([icon({ label: 'Server' })]));
      expect(svg).toContain('<rect'); // the generic body
      expect(svg).toContain('>Server</');
      expect(svg).not.toContain('viewBox="0 0 24');
    });
  });
});
