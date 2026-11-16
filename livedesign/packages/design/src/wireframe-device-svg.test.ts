import { describe, expect, it } from 'vitest';
import { WIREFRAME_DEVICE_IDS, deviceGeometry, type WireframeFrameLook } from './wireframe-device';
import { wireframeFrameOverSvg, wireframeFrameUnderSvg } from './wireframe-device-svg';

// A frame's markup goes into the SVG export, which a strict XML reader (and the PDF writer,
// liveworkspace/docs/specs/013-export/vector-pdf.md) parses: an attribute named twice on one element is invalid XML.
const repeated = (svg: string): string[] =>
  [...svg.matchAll(/<[a-zA-Z][^\s/>]*([^>]*)>/g)].flatMap(([tag, attrs]) => {
    const names = [...attrs!.matchAll(/\s([a-zA-Z:-]+)=/g)].map((m) => m[1]!);
    return names.length === new Set(names).size ? [] : [tag];
  });

describe('wireframe frames as SVG', () => {
  it('name each attribute once on every element, for every device, look and orientation', () => {
    const looks: WireframeFrameLook[] = ['theme', 'dark', 'light', 'outline'];
    for (const id of WIREFRAME_DEVICE_IDS)
      for (const landscape of [false, true])
        for (const look of looks) {
          const g = deviceGeometry(id, landscape);
          const svg =
            wireframeFrameUnderSvg(g, look, 0, 0, 'Home') +
            wireframeFrameOverSvg(g, look, 0, 0, { systemBars: true, dark: look === 'dark' });
          expect(repeated(svg), `${id} ${look}${landscape ? ' landscape' : ''}`).toEqual([]);
        }
  });

  it('finds a repeated attribute', () => {
    expect(
      repeated('<path stroke-width="1" d="M0 0" stroke-width="2"/><rect x="1"/>'),
    ).toHaveLength(1);
  });
});
