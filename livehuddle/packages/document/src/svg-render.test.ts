import { svgTags, textTagBefore } from '@liveworkspace/model-core/svg-test-tags';
import { describe, expect, it } from 'vitest';
import type { ImageElement, RetiredArrowElement, ShapeElement, Tab } from './index';
import { contentBounds, renderElementsToSvg } from './svg-render';

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
  o: Partial<RetiredArrowElement> = {},
): RetiredArrowElement => ({
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
  it('renders a self-contained SVG with shapes, a stored arrow and a background', () => {
    const svg = renderElementsToSvg(
      tab([shape('a'), shape('b', { x: 200 }), pinnedArrow('arr', 'a', 'b')]),
    );
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('<rect'); // shape bodies + background
    expect(svg).toContain('<line data-retired-arrow-line'); // the stored arrow's placeholder line
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

    // The href is resolved from document data, and the export preview renders
    // this SVG as HTML, so a quote must never close the attribute.
    it('escapes the resolved href so it cannot break out of the attribute', () => {
      const href = 'data:image/png;base64,"/><img src=x onerror=alert(1)>';
      const svg = renderElementsToSvg(tab([image('i')]), { resolveImageHref: () => href });
      expect(svg).not.toContain('<img');
      expect(svg).toContain('href="data:image/png;base64,&quot;/&gt;&lt;img');
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

  // Fonts (docs/specs/004-interface-design/fonts.md) used to stop at the canvas: every export painted
  // system-ui, so a downloaded canvas looked like a different one.
  describe('fonts', () => {
    // The renderer XML-escapes every attribute, quotes included; read the
    // markup back the way a browser does so the assertions stay legible.
    const plain = (svg: string) => svg.replace(/&#39;/g, "'").replace(/&amp;/g, '&');

    it('paints an element in its own face', () => {
      const svg = plain(renderElementsToSvg(tab([shape('a', { label: 'Hi', font: 'lora' })])));
      expect(svg).toContain('font-family="\'Lora\', ui-serif, Georgia, serif"');
    });

    it("falls back to the tab's face, then to the plain UI sans", () => {
      const withTab = plain(
        renderElementsToSvg(tab([shape('a', { label: 'Hi' })], { font: 'oswald' })),
      );
      expect(withTab).toContain("font-family=\"'Oswald'");
      const bare = renderElementsToSvg(tab([shape('a', { label: 'Hi' })]));
      expect(bare).toContain('font-family="system-ui, sans-serif"');
    });

    it('lets an element override the tab default', () => {
      const svg = plain(
        renderElementsToSvg(tab([shape('a', { label: 'Hi', font: 'lora' })], { font: 'oswald' })),
      );
      expect(svg).toContain("font-family=\"'Lora'");
      expect(svg).not.toContain("font-family=\"'Oswald'");
    });

    it('declares the faces it used, so the file stands alone', () => {
      const svg = renderElementsToSvg(tab([shape('a', { label: 'Hi', font: 'lora' })]));
      expect(svg).toContain('<style');
      expect(svg).toContain('fonts.googleapis.com');
      expect(svg).toContain('Lora');
      // Only what it used — an export shouldn't pull eleven families.
      expect(svg).not.toContain('Permanent+Marker');
    });

    it('says nothing about fonts when nothing asked for one', () => {
      expect(renderElementsToSvg(tab([shape('a', { label: 'Hi' })]))).not.toContain('<style');
    });
  });

  describe('sticky notes', () => {
    const sticky = (o: Record<string, unknown> = {}) =>
      ({
        id: 'st',
        type: 'sticky',
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        label: 'Order placed',
        ...o,
      }) as Tab['elements'][number];

    it('exports square corners (a sticky is die-cut paper, never rounded)', () => {
      const svg = renderElementsToSvg(tab([sticky()]));
      expect(svg).toContain('rx="0"');
      expect(svg).not.toContain('rx="6"');
    });

    it('exports borderless by default; an explicit strokeColor still draws', () => {
      // Matches the canvas: a sticky is borderless paper unless the user
      // deliberately set a border colour.
      expect(renderElementsToSvg(tab([sticky()]))).toContain('stroke="none"');
      expect(renderElementsToSvg(tab([sticky({ strokeColor: '#b45309' })]))).toContain(
        'stroke="#b45309"',
      );
    });

    it('leaves an ordinary sticky as written', () => {
      expect(renderElementsToSvg(tab([sticky()]))).toContain('Order placed');
    });
  });

  describe('silhouettes + rotation', () => {
    it('renders a hexagon silhouette instead of a rectangle', () => {
      const svg = renderElementsToSvg(tab([shape('h', { shape: 'hexagon' })]));
      // The table's 0..100 hexagon, mapped onto the 100 x 80 box inset by
      // half the medium stroke, so the outline stays inside the box.
      expect(svg).toContain('polygon points="25.5,1 74.5,1 99,40 74.5,79 25.5,79 1,40"');
    });

    it('applies element rotation about the centre', () => {
      const svg = renderElementsToSvg(tab([shape('r', { rotation: 45 })]));
      expect(svg).toContain('transform="rotate(45 50 40)"');
    });
  });

  describe('label fidelity (docs/specs/008-canvas/canvas-and-palette.md)', () => {
    it('anchors a top-aligned label at the element top, not its vertical centre', () => {
      // A section-title label (top + right): the text must export at the
      // box's top edge — it floated at the vertical centre before.
      const svg = renderElementsToSvg(
        tab([
          shape('fr', {
            shape: 'square',
            width: 400,
            height: 300,
            label: 'Change Events',
            textAlignX: 'right',
            textAlignY: 'top',
          }),
        ]),
      );
      const y = textTagBefore(svg, 'Change Events')?.y;
      expect(y).toBeDefined();
      // Top pad + half the font size: well inside the top band (y=0..40),
      // nowhere near the centre (150).
      expect(parseFloat(y!)).toBeLessThan(40);
    });

    it('wraps a rich (per-run) label to the element width', () => {
      // Two runs whose combined width far exceeds the 120px box: the rich
      // emitter must break lines (it used to lay every run on ONE line).
      const svg = renderElementsToSvg(
        tab([
          shape('rt', {
            width: 120,
            height: 80,
            label: 'getPartnerID (Discard other data)',
            richText: [
              { text: 'getPartnerID ', bold: true, size: 'lg' },
              { text: '(Discard other data)', size: 'sm' },
            ],
          }),
        ]),
      );
      // More than one positioned line-tspan (x + dy) means it wrapped.
      const lineStarts = svg.match(/<tspan x="[0-9.]+" dy="/g) ?? [];
      expect(lineStarts.length).toBeGreaterThan(0);
    });

    it('draws an extra-small run at 10 px, as the canvas does', () => {
      const svg = renderElementsToSvg(
        tab([
          shape('xs', {
            width: 200,
            height: 80,
            label: 'Title note',
            richText: [{ text: 'Title ' }, { text: 'note', size: 'xs' }],
          }),
        ]),
      );
      expect(svg).toMatch(/font-size="10"[^>]*>\s?note</);
    });

    it('stacks a wrapped bottom caption upward into the box', () => {
      // A long caption on a bottom-aligned icon element: the block's LAST
      // line sits at the bottom anchor, so the first line's y moves UP —
      // it used to centre on the anchor and spill below the element.
      const svg = renderElementsToSvg(
        tab([
          shape('ic2', {
            shape: 'icon',
            iconId: 'server',
            width: 64,
            height: 64,
            // 'sm' (14px) is the size this case was measured at; the default
            // is 22px, at which a single word already overflows a 64px box
            // and the test would be about overflow rather than stacking.
            textSize: 'sm',
            label: 'restaurant hygienerating updated',
          }),
        ]),
        { resolveIconArt: () => ({ markup: '<path d="M1 2"/>', colored: false }) },
      );
      const y = textTagBefore(svg, 'restaurant')?.y;
      expect(y).toBeDefined();
      // Bottom anchor is y=64-12=52; a 3-line block must start well above
      // it and every line must stay inside the 64px box.
      expect(parseFloat(y!)).toBeLessThan(40);
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
      // 48px box over a 24-unit viewBox = 2x scale, so the regular 1.25px
      // on-screen stroke exports as 0.63 glyph units.
      expect(svg).toContain('stroke-width="0.63"');
    });

    it('exports the element icon weight as its on-screen stroke', () => {
      const art = { resolveIconArt: () => ({ markup: '<path d="M1 2"/>', colored: false }) };
      expect(renderElementsToSvg(tab([icon({ iconWeight: 'bold' })]), art)).toContain(
        'stroke-width="1"',
      );
      expect(renderElementsToSvg(tab([icon({ iconWeight: 'thin' })]), art)).toContain(
        'stroke-width="0.38"',
      );
    });

    it('scales a captioned glyph into the band opposite the label (docs/specs/010-palette/technology-icons.md bands)', () => {
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

    it('draws a Technology mark at its fixed preset size, centred (docs/specs/010-palette/technology-icons.md)', () => {
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

    it('strokes a Technology glyph at the chrome weight for its preset size (docs/specs/004-interface-design/iconography.md)', () => {
      const art = () => ({ markup: '<circle/>', colored: true });
      const strokeOf = (el: Parameters<typeof icon>[0]) =>
        svgTags(renderElementsToSvg(tab([icon(el)]), { resolveIconArt: art }), 'svg').find(
          (t) => t.viewBox === '0 0 24 24',
        )?.['stroke-width'];
      // 1.25px on screen: 1.25 * 24 / preset px, in tile box units.
      expect(strokeOf({ width: 200, height: 200 })).toBe('0.625'); // md, 48px
      expect(strokeOf({ width: 200, height: 200, iconSize: 'sm' })).toBe('0.9375');
      expect(strokeOf({ width: 200, height: 200, iconSize: 'lg' })).toBe('0.46875');
      // A preset clamped by a small box scales as one picture, weight included.
      expect(strokeOf({ width: 60, height: 60, iconSize: 'xl' })).toBe('0.3125');
    });

    it('sends a top-captioned Technology mark to the bottom band (docs/specs/010-palette/technology-icons.md)', () => {
      const art = () => ({ markup: '<circle/>', colored: true });
      const svg = renderElementsToSvg(
        tab([icon({ width: 100, height: 100, label: 'EC2', textAlignY: 'top' })]),
        { resolveIconArt: art },
      );
      // Band y0 = 36% of 100; the 48px mark centres inside the 58% band.
      expect(svg).toContain('x="26" y="41" width="48" height="48"');
      // The caption sits near the top instead of the floor.
      expect(svg).toContain('y="22"'); // el.y + fontSize (default md = 22)
    });

    it('sends a left-captioned mark to the right half, on the caption row (docs/specs/010-palette/technology-icons.md)', () => {
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

    it('puts a middle-centre label on the glyph (docs/specs/010-palette/technology-icons.md "Middle-centre puts the label on the glyph")', () => {
      const art = () => ({ markup: '<circle/>', colored: true });
      const svg = renderElementsToSvg(
        tab([icon({ width: 100, height: 100, label: 'EC2', textAlignY: 'middle' })]),
        { resolveIconArt: art },
      );
      // The mark keeps the whole box, as if unlabelled: centred, y = (100 - 48) / 2.
      expect(svg).toContain('y="26" width="48" height="48"');
      // The label centres over it, drawn after the art so it sits on top. It used to
      // sit in the top band at y = 14, clear of the art.
      const text = textTagBefore(svg, 'EC2');
      expect(text?.['dominant-baseline']).toBe('central');
      expect(parseFloat(text!.y!)).toBe(50);
      expect(svg.indexOf('<text')).toBeGreaterThan(svg.indexOf('<circle/>'));
    });

    it('centres a side caption on the glyph row and wraps it at its half (docs/specs/010-palette/technology-icons.md)', () => {
      const art = () => ({ markup: '<circle/>', colored: true });
      // Left caption on the top row: both the mark and the caption sit on the
      // 6..64% row — the caption vertically centred on it (y = 6 + 58/2 = 35)
      // instead of hugging the box's top edge.
      const svg = renderElementsToSvg(
        tab([
          icon({ width: 200, height: 100, label: 'EC2', textAlignX: 'left', textAlignY: 'top' }),
        ]),
        { resolveIconArt: art },
      );
      expect(svg).toContain('x="120" y="11" width="48" height="48"'); // mark on the top row
      expect(svg).toMatch(/<text[^>]*y="35"/);
      // A long left caption wraps at its half of the box (maxWidth = 100-16)
      // instead of running under the mark on one line.
      const wrapped = renderElementsToSvg(
        tab([
          icon({
            width: 200,
            height: 100,
            label: 'Application load balancer',
            textAlignX: 'left',
            textAlignY: 'middle',
          }),
        ]),
        { resolveIconArt: art },
      );
      const lineStarts = wrapped.match(/<tspan x="[0-9.]+" dy="/g) ?? [];
      expect(lineStarts.length).toBeGreaterThan(1);
    });

    it('falls back to the box-with-label output without a resolver', () => {
      const svg = renderElementsToSvg(tab([icon({ label: 'Server' })]));
      expect(svg).toContain('<rect'); // the generic body
      expect(svg).toContain('>Server</');
      expect(svg).not.toContain('viewBox="0 0 24');
    });
  });
});

// Element drop shadows (docs/specs/008-canvas/element-shadows.md): a shadowed element references a shared
// feDropShadow def; shadow-less documents carry no <defs> so their output
// stays byte-identical to before the feature.
describe('renderElementsToSvg — element shadows (docs/specs/008-canvas/element-shadows.md)', () => {
  const shadow = { offsetX: 0, offsetY: 4, blur: 12, opacity: 0.25 };

  it('emits one filter def per unique shadow and references it from the element group', () => {
    const svg = renderElementsToSvg(
      tab([shape('a', { shadow }), shape('b', { x: 200, shadow: { ...shadow } })]),
    );
    expect(svg).toContain('<feDropShadow');
    // Two elements, one shared def (deterministic id).
    expect(svg.match(/<filter /g)?.length).toBe(1);
    expect(svg.match(/filter="url\(#elshadow-/g)?.length).toBe(2);
  });

  it('emits no defs block when nothing carries a shadow', () => {
    const svg = renderElementsToSvg(tab([shape('a')]));
    expect(svg).not.toContain('<defs>');
    expect(svg).not.toContain('feDropShadow');
  });
});

// Drawn-on-the-box chrome (docs/specs/008-canvas/canvas-and-palette.md): the border the canvas draws.
describe('chrome the canvas draws on a box', () => {
  it("draws a shape's own border width, dash and radius, inside the box", () => {
    const svg = renderElementsToSvg(
      tab([shape('s', { strokeWidth: 'thick', strokeStyle: 'dashed', borderRadius: 'lg' })]),
    );
    // 4px stroke inset by 2; Large's 24 px capped at a quarter of the 80 px side
    // (docs/specs/008-canvas/corner-radius.md), 20 less 2; the canvas's dashed pattern.
    expect(svg).toMatch(/<rect[^>]*rx="18"[^>]*stroke-width="4" stroke-dasharray="6 5"/);
  });
});

// A stored arrow (docs/specs/002-project-scope/blueprints/element-engine.md D21) draws a line and a 160 by 96 card
// on its middle; the export sizes itself to both.
describe('contentBounds', () => {
  it('includes a stored arrow’s line and its placeholder card', () => {
    const els = [
      shape('a', { x: 0, y: 0, width: 10, height: 10 }),
      shape('b', { x: 20, y: 0, width: 10, height: 10 }),
      pinnedArrow('arr', 'a', 'b'),
    ];
    // The ends sit at (10, 5) and (20, 5): the card spans x -65..95 and y -23..33.
    expect(contentBounds(els)).toEqual({ x: -65, y: -43, w: 160, h: 96 });
  });
});

// An empty <tspan> carries no glyph, so SVG drops its `dy` with it: a blank
// line the author typed collapsed, and the text below it moved up a line.
describe('blank lines in a wrapped label', () => {
  it('keep their height as a non-breaking space', () => {
    const svg = renderElementsToSvg(tab([shape('a', { label: '1\n\n2', height: 200 })]));
    const tspans = [...svg.matchAll(/<tspan[^<>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]);
    expect(tspans).toEqual(['1', '\u00a0', '2']);
  });
});

// A stored arrow is a retired element: its line and card paint in array order, like any element
// (docs/specs/006-document/layers.md).
describe('a stored arrow in an export', () => {
  const row = [
    shape('a', { x: 0, y: 0 }),
    shape('b', { x: 200, y: 0 }),
    shape('c', { x: 400, y: 0 }),
  ];

  it('paints in array order, so an arrow stored behind a box stays behind it', () => {
    const svg = renderElementsToSvg(tab([row[0]!, row[2]!, pinnedArrow('x', 'a', 'c'), row[1]!]));
    const arrowAt = svg.indexOf('data-retired-arrow=');
    // Box b sits at x = 200; its border is drawn inside the box, so its rect starts half a border in.
    const boxAt = svg.search(/<rect x="20[01](\.\d+)?"/);
    expect(boxAt).toBeGreaterThan(-1);
    expect(arrowAt).toBeGreaterThan(-1);
    expect(arrowAt).toBeLessThan(boxAt);
  });

  it('draws a straight dashed line between the ends, never a route or a head', () => {
    const svg = renderElementsToSvg(
      tab([...row, pinnedArrow('x', 'a', 'c', { label: 'flows', arrowEnds: 'both' })]),
    );
    expect(svg).toContain('x1="100" y1="40" x2="400" y2="40"');
    expect(svg).not.toContain('mask=');
    expect(svg).not.toContain('<polygon');
  });
});
