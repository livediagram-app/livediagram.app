import { describe, expect, it } from 'vitest';
import {
  MARKER_FACE_MAX_PARTS,
  facePartRole,
  isInkColour,
  markerFacePart,
  markerFaceSeed,
  markerFrameInk,
  sketchFacePart,
  type FacePartPaint,
} from './marker-face';
import { outlineOfEllipse, outlineOfPath, outlineOfRect } from './sketch';
import { svgMarkerFace } from './svg-render-face-finish';

// docs/specs/008-canvas/finish.md "Marker", "Faces: frames and shapes".
const face = { width: 400, height: 300 };
const paint = (p: Partial<FacePartPaint>): FacePartPaint => ({
  fill: null,
  stroke: null,
  strokePx: 0,
  ...p,
});

describe('isInkColour', () => {
  it('tells a colour from nothing', () => {
    expect(isInkColour('#123')).toBe(true);
    expect(isInkColour('rgb(1, 2, 3)')).toBe(true);
    for (const none of [
      null,
      '',
      'none',
      'transparent',
      'url(#g)',
      'rgba(0, 0, 0, 0)',
      'rgb(0 0 0 / 0)',
    ])
      expect(isInkColour(none)).toBe(false);
  });
});

describe('markerFrameInk', () => {
  it('pulls a pale border toward black on a light card', () => {
    expect(markerFrameInk('#e2e8f0', '#ffffff')).toBe('#7c8084');
  });

  it('pulls a border toward white on a dark card', () => {
    expect(markerFrameInk('#334155', '#0f172a')).toBe('#8f97a2');
  });

  it('reads a see-through border as it shows on its card', () => {
    // 10% black over white shows as 229.5 grey, then pulled 45% toward black.
    expect(markerFrameInk('rgba(0, 0, 0, 0.1)', 'rgb(255, 255, 255)')).toBe('#7e7e7e');
  });

  it('draws a colour it cannot read as it is', () => {
    expect(markerFrameInk('oklch(0.7 0.1 200)', '#fff')).toBe('oklch(0.7 0.1 200)');
  });
});

describe('facePartRole', () => {
  const rect = (w: number, h: number, rx = 0) =>
    ({ kind: 'rect', x: 0, y: 0, width: w, height: h, rx }) as const;
  const roleOf = (w: number, h: number, p: FacePartPaint, rx = 0) =>
    facePartRole(rect(w, h, rx), outlineOfRect(0, 0, w, h, rx), p, face);

  it('outlines a card as a frame', () => {
    expect(roleOf(120, 60, paint({ fill: '#fff', stroke: '#ccc', strokePx: 1 }))).toBe('frame');
  });

  it('outlines a box marked a frame at any size or roundness (a Minimal Plan card)', () => {
    const card = paint({ fill: '#fff', stroke: '#ccc', strokePx: 1 });
    // Unmarked, a 36 px tall card is under the frame's least size: coloured in, which a card never is.
    expect(roleOf(513, 36, card, 6)).toBe('shape');
    expect(roleOf(513, 36, { ...card, frame: true }, 6)).toBe('frame');
    expect(roleOf(513, 36, { ...card, frame: true }, 18)).toBe('frame');
    // Still only an outlined rectangle, never dashed.
    expect(roleOf(513, 36, { ...card, stroke: null, frame: true }, 6)).toBe('shape');
    expect(roleOf(513, 36, { ...card, strokePx: 0, frame: true }, 6)).toBe('shape');
    expect(roleOf(513, 36, { ...card, dashed: true, frame: true }, 6)).toBeNull();
  });

  it('colours in a band or a bar', () => {
    expect(roleOf(300, 40, paint({ fill: '#38bdf8' }))).toBe('shape');
    expect(roleOf(12, 90, paint({ fill: '#38bdf8' }))).toBe('shape');
  });

  it('leaves small parts, pills, slivers and the backdrop plain', () => {
    expect(roleOf(20, 20, paint({ fill: '#38bdf8' }))).toBeNull();
    expect(roleOf(80, 20, paint({ fill: '#38bdf8' }), 10)).toBeNull();
    expect(roleOf(200, 3, paint({ fill: '#38bdf8' }))).toBeNull();
    expect(roleOf(370, 270, paint({ fill: '#f8fafc' }))).toBeNull();
    expect(roleOf(120, 60, paint({}))).toBeNull();
  });

  it("colours the face's own box in, outlined or only filled, unless its body is already drawn", () => {
    expect(roleOf(400, 300, paint({ fill: '#0ea5e9' }))).toBe('shape');
    expect(roleOf(396, 296, paint({ fill: '#fff', stroke: '#ccc', strokePx: 1 }))).toBe('shape');
    expect(roleOf(400, 300, paint({ stroke: '#ccc', strokePx: 1 }))).toBe('frame');
    const drawn = { ...face, bodyDrawn: true };
    expect(
      facePartRole(
        rect(400, 300),
        outlineOfRect(0, 0, 400, 300, 0),
        paint({ fill: '#0ea5e9' }),
        drawn,
      ),
    ).toBeNull();
  });

  it('keeps a dashed line as drawn (a progress arc would close)', () => {
    const ring = { kind: 'ellipse', cx: 50, cy: 50, rx: 40, ry: 40 } as const;
    expect(
      facePartRole(
        ring,
        outlineOfEllipse(50, 50, 40, 40),
        paint({ stroke: '#333', strokePx: 8, dashed: true }),
        face,
      ),
    ).toBeNull();
  });

  it('colours in a disc that fills its face (an onion ring), which is never a backdrop', () => {
    const disc = { kind: 'ellipse', cx: 200, cy: 150, rx: 200, ry: 150 } as const;
    expect(
      facePartRole(disc, outlineOfEllipse(200, 150, 200, 150), paint({ fill: '#bae6fd' }), face),
    ).toBe('shape');
  });

  it('draws a polyline (a chart series) as a line', () => {
    const points = [
      { x: 0, y: 80 },
      { x: 100, y: 20 },
      { x: 200, y: 60 },
    ];
    const line = { kind: 'polyline', points } as const;
    expect(
      facePartRole(
        line,
        { segments: [], area: null },
        paint({ stroke: '#0ea5e9', strokePx: 2 }),
        face,
      ),
    ).toBeNull();
    expect(
      markerFacePart(line, paint({ fill: 'none', stroke: '#0ea5e9', strokePx: 2 }), face, 1, 0)
        ?.role,
    ).toBe('line');
  });

  it('draws a ring as a line', () => {
    const ring = { kind: 'ellipse', cx: 50, cy: 50, rx: 40, ry: 40 } as const;
    expect(
      facePartRole(
        ring,
        outlineOfEllipse(50, 50, 40, 40),
        paint({ stroke: '#333', strokePx: 2 }),
        face,
      ),
    ).toBe('line');
  });

  it('draws an open arc as a line, never colours it in', () => {
    const d = 'M 10 80 A 60 60 0 0 1 130 80';
    expect(
      facePartRole(
        { kind: 'path', d },
        outlineOfPath(d),
        paint({ fill: '#38bdf8', stroke: '#333', strokePx: 2 }),
        face,
      ),
    ).toBe('line');
  });
});

describe('markerFacePart', () => {
  const seed = markerFaceSeed('el');
  const band = { kind: 'rect', x: 10, y: 10, width: 300, height: 40, rx: 8 } as const;

  it('is the same for the same part, and differs part to part', () => {
    const a = markerFacePart(band, paint({ fill: '#38bdf8' }), face, seed, 0);
    expect(markerFacePart(band, paint({ fill: '#38bdf8' }), face, seed, 0)).toEqual(a);
    expect(markerFacePart(band, paint({ fill: '#38bdf8' }), face, seed, 1)).not.toEqual(a);
  });

  it('colours a shape in streaks and outlines it in a deeper shade of its fill when it has no line', () => {
    const part = markerFacePart(band, paint({ fill: '#38bdf8' }), face, seed, 0)!;
    expect(part.role).toBe('shape');
    expect(part.svg).toContain(`stroke="${markerFrameInk('#38bdf8', '#38bdf8')}"`);
    expect(part.svg).not.toContain('stroke="#38bdf8"');
    // A colourful fill's own shade is laid down heavier than a line's (MARKER_FACE_STREAK_OPACITY scaled by chroma).
    const streak = Number(/stroke-opacity="([\d.]+)"/.exec(part.svg)![1]);
    expect(streak).toBeGreaterThan(0.07);
    const grey = markerFacePart(band, paint({ fill: '#f1f5f9' }), face, seed, 0)!;
    expect(Number(/stroke-opacity="([\d.]+)"/.exec(grey.svg)![1])).toBeLessThan(streak);
  });

  it("outlines a part in its own line's colour when it has one", () => {
    const slim = { ...band, height: 30 };
    const part = markerFacePart(
      slim,
      paint({ fill: '#38bdf8', stroke: '#0369a1', strokePx: 1 }),
      face,
      seed,
      0,
    )!;
    expect(part.role).toBe('shape');
    expect(part.svg).toContain('stroke="#0369a1"');
  });

  it('carries the part opacity', () => {
    const part = markerFacePart(band, paint({ fill: '#38bdf8', opacity: 0.5 }), face, seed, 0)!;
    expect(part.svg).toContain('opacity="0.5"');
  });
});

describe('svgMarkerFace', () => {
  it('keeps a band solid, draws its marker over it, and leaves small parts and text', () => {
    const out = svgMarkerFace(
      '<rect x="0" y="0" width="300" height="40" rx="8" fill="#38bdf8"/><circle cx="5" cy="5" r="4" fill="#000"/><text>Hi</text>',
      'el',
      face,
    );
    expect(out).toContain(
      '<rect x="0" y="0" width="300" height="40" rx="8" fill="#38bdf8"/><g data-marker-part="shape"',
    );
    expect(out).toContain('<circle cx="5" cy="5" r="4" fill="#000"/>');
    expect(out).toContain('<text>Hi</text>');
  });

  it("drops a frame's own line for the marker's", () => {
    const out = svgMarkerFace(
      '<rect x="0" y="0" width="200" height="100" fill="#fff" stroke="#ccc" stroke-width="1"/>',
      'el',
      face,
    );
    expect(out).toMatch(
      /^<rect x="0" y="0" width="200" height="100" fill="#fff"\/><g data-marker-part="frame"/,
    );
  });

  it('outlines a box marked a frame under the least size (a Minimal Plan card), never colouring it in', () => {
    const card = '<rect x="0" y="0" width="200" height="36" rx="8" fill="#fff" stroke="#ccc" stroke-width="1"';
    expect(svgMarkerFace(`${card}/>`, 'el', face)).toContain('<g data-marker-part="shape"');
    expect(svgMarkerFace(`${card} data-marker-frame=""/>`, 'el', face)).toMatch(
      /^<rect [^>]*fill="#fff" data-marker-frame=""\/><g data-marker-part="frame"/,
    );
  });

  it('keeps clips, definitions, a drawn body, arrowed lines and kept parts as they are', () => {
    const held =
      '<clipPath id="c"><rect width="300" height="300"/></clipPath><g data-finish="marker"><path d="M0 0 L300 0" stroke="#000"/></g>' +
      '<path d="M0 0 L200 0" stroke="#000" marker-end="url(#h)"/><rect width="200" height="100" stroke="#000" data-finish-keep=""/>';
    expect(svgMarkerFace(held, 'el', face)).toBe(held);
  });

  it('wraps a part with its own transform in it', () => {
    const out = svgMarkerFace(
      '<rect width="300" height="40" fill="#38bdf8" transform="rotate(5)"/>',
      'el',
      face,
    );
    expect(out).toContain('<g transform="rotate(5)"><g data-marker-part="shape"');
  });

  it(`draws at most ${MARKER_FACE_MAX_PARTS} parts`, () => {
    const many = Array.from(
      { length: MARKER_FACE_MAX_PARTS + 5 },
      (_, i) => `<rect x="0" y="${i}" width="100" height="30" fill="#38bdf8"/>`,
    ).join('');
    expect(svgMarkerFace(many, 'el', face).match(/data-marker-part/g)).toHaveLength(
      MARKER_FACE_MAX_PARTS,
    );
  });

  it('colours in a chevron drawn as a polygon', () => {
    const out = svgMarkerFace(
      '<polygon points="0,0 120,0 150,40 120,80 0,80 30,40" fill="#38bdf8"/>',
      'el',
      face,
    );
    expect(out).toContain('<g data-marker-part="shape"');
  });
});

// The face-finish pass writes these parts straight into the DOM through trustedHtml, unsanitised (its hot path; the
// Trusted Types spec's "The sanitiser"), so every colour it places is escaped: a colour that tries to close its
// attribute or open an element stays text inside the attribute.
describe('a hostile colour', () => {
  const hostile = [
    'red" onload="alert(1)',
    "red' onload='alert(1)",
    '#000"><img src=x onerror=alert(1)>',
    'rgb(1,2,3)</g><script>alert(1)</script>',
    'blue&quot; onclick=&quot;alert(1)',
  ];
  const band = { kind: 'rect', x: 10, y: 10, width: 300, height: 40, rx: 0 } as const;
  const disc = { kind: 'ellipse', cx: 200, cy: 150, rx: 120, ry: 90 } as const;
  const points = [
    { x: 0, y: 80 },
    { x: 200, y: 60 },
  ];
  const line = { kind: 'polyline', points } as const;
  // The part with every attribute value emptied: only <g> and <path> tags, and attribute names that are no event
  // handler, may be left, so
  // nothing broke out of a value. A value itself holds no raw quote, angle bracket or bare ampersand.
  const SHAPE = /^(?:<\/?(?:g|path)(?: (?!on)[a-z-]+="")*\/?>)+$/;
  const RAW_IN_VALUE = /="[^"]*(?:<|>|&(?!amp;|lt;|gt;|quot;|#39;))[^"]*"/;

  it.each(hostile)('stays text in a marker or sketch part: %s', (colour) => {
    const parts = [
      markerFacePart(line, paint({ fill: 'none', stroke: colour, strokePx: 2 }), face, 1, 0),
      markerFacePart(band, paint({ fill: colour }), face, 1, 1),
      markerFacePart(band, paint({ fill: '#38bdf8', stroke: colour, strokePx: 2 }), face, 1, 2),
      sketchFacePart(disc, paint({ fill: '#bae6fd', stroke: colour, strokePx: 2 }), face, 1, 3),
    ].filter((p) => p !== null);
    expect(parts.length).toBeGreaterThan(0);
    for (const { svg } of parts) {
      expect(svg.replace(/="[^"]*"/g, '=""')).toMatch(SHAPE);
      expect(svg).not.toMatch(RAW_IN_VALUE);
    }
  });
});
