import { describe, expect, it } from 'vitest';
import { renderElementsToSvg } from './svg-render';
import { createShape, createText } from './factories';
import { wrapLabel } from './svg-render-primitives';
import type { Tab } from './index';

// Faces export the way the canvas draws them (docs/specs/020-import-export/export-fidelity.md).

describe('Face export', () => {
  it('draws an arrow whose stored head shape this build does not know with the default head', () => {
    const a = createShape('square', 0, 0);
    const b = createShape('square', 300, 0);
    const svg = renderElementsToSvg({
      id: 't',
      name: 'T',
      elements: [
        a,
        b,
        {
          id: 'arr',
          type: 'arrow',
          from: { kind: 'pinned', elementId: a.id, anchor: 'e' },
          to: { kind: 'pinned', elementId: b.id, anchor: 'w' },
          arrowEnds: 'both',
          arrowheadShape: 'star' as never,
          arrowheadStartShape: 'moon' as never,
        },
      ],
    });
    expect(svg).toContain('<polygon');
  });
});

describe('wrapLabel', () => {
  it('breaks a word wider than the line, as the canvas does', () => {
    const lines = wrapLabel('smartwatch', 50, (s) => s.length * 7, true);
    expect(lines).toEqual(['smartwa', 'tch']);
  });

  it('never cuts an emoji in half when it breaks a word', () => {
    // Each emoji is two UTF-16 units; a line holds one and a half of them.
    const lines = wrapLabel('😀😀😀', 21, (s) => [...s].length * 14, true);
    expect(lines).toEqual(['😀', '😀', '😀']);
    // A flag (two code points) and a joined family emoji stay whole too.
    expect(wrapLabel('🇬🇧👨‍👩‍👧', 10, (s) => [...s].length * 14, true)).toEqual(['🇬🇧', '👨‍👩‍👧']);
  });

  it('keeps an over-long word whole for an icon caption', () => {
    expect(wrapLabel('smartwatch', 50, (s) => s.length * 7)).toEqual(['smartwatch']);
  });
});

// docs/specs/006-document/document-structure.md "Data model": a Shift-resized text box draws its text
// scaled, and exports that way too.
describe('Scaled text box export', () => {
  it('draws the label at its size times its scale', () => {
    const el = { ...createText(0, 0), id: 'txt', label: 'Big', textSize: 'sm' as const };
    const tab = (textScale?: number) =>
      ({ id: 't', name: 'T', elements: [{ ...el, textScale }] }) as unknown as Tab;
    expect(renderElementsToSvg(tab())).toContain('font-size="14"');
    expect(renderElementsToSvg(tab(2.5))).toContain('font-size="35"');
  });
});
