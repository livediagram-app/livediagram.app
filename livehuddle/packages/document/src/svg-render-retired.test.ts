import { describe, expect, it } from 'vitest';
import { RETIRED_PLACEHOLDER_COLOURS, retiredPlaceholderLayout } from './retired-placeholder';
import { boxedNeedsSvgRaster, renderElementsToSvg, svgBoxed } from './svg-render';
import { svgRetiredElement } from './svg-render-retired';
import type { BoxedElement, ShapeElement } from './index';

// docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements": the export and the thumbnail draw a retired
// element as a plain placeholder card in its own box.

const retired = (shape: string, fields: Record<string, unknown> = {}) =>
  ({
    id: 'r',
    type: 'shape',
    shape,
    x: 100,
    y: 50,
    width: 320,
    height: 220,
    label: '',
    ...fields,
  }) as unknown as ShapeElement;

const texts = (svg: string) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

describe('retiredPlaceholderLayout', () => {
  it('stacks the name, the note and the label, centred down the box', () => {
    const card = retiredPlaceholderLayout(retired('qa-board', { label: 'Sprint questions' }));
    expect(card.lines.map((l) => [l.role, l.text])).toEqual([
      ['name', 'Q&A Board'],
      ['note', 'No longer supported in livehuddle'],
      ['label', 'Sprint questions'],
    ]);
    const [name, note, label] = card.lines;
    expect(name!.size).toBeGreaterThan(note!.size);
    expect(name!.baseline).toBeLessThan(note!.baseline);
    expect(note!.baseline).toBeLessThan(label!.baseline);
    // Centred: as much room above the first line as below the last.
    const top = name!.baseline - name!.size;
    const bottom = 220 - label!.baseline;
    expect(Math.abs(top - bottom)).toBeLessThan(6);
    expect(card.strokeWidth).toBe(1.5);
    expect(card.dash.length).toBe(2);
  });

  it('leaves out an empty label', () => {
    const card = retiredPlaceholderLayout(retired('agenda', { label: '   ' }));
    expect(card.lines.map((l) => l.role)).toEqual(['name', 'note']);
  });

  it('cuts a long label to the box with an ellipsis', () => {
    const long = 'A very long stored label that runs well past the width of a narrow card';
    const card = retiredPlaceholderLayout(retired('decision', { label: long, width: 160 }));
    const label = card.lines.find((l) => l.role === 'label')!;
    expect(label.text.endsWith('…')).toBe(true);
    expect(label.text.length).toBeLessThan(long.length);
  });

  it('keeps the name when the box is too short for the rest', () => {
    const card = retiredPlaceholderLayout(retired('quiz', { label: 'Q', height: 30 }));
    expect(card.lines.map((l) => l.role)).toEqual(['name']);
    const mid = retiredPlaceholderLayout(retired('quiz', { label: 'Q', height: 60 }));
    expect(mid.lines.map((l) => l.role)).toEqual(['name', 'note']);
  });

  it('survives a box with no size, and a label that is not text', () => {
    const card = retiredPlaceholderLayout(
      retired('hologram', { width: Number.NaN, height: -4, label: 7 }),
    );
    expect(card.lines.map((l) => l.text)).toEqual(['…']);
    expect(card.radius).toBe(0);
  });
});

describe('svgRetiredElement', () => {
  it('draws a dashed, muted card with the name, the note and the label, escaped', () => {
    const svg = svgRetiredElement(retired('qa-board', { label: 'Ask <us>' }));
    expect(svg).toContain(`stroke="${RETIRED_PLACEHOLDER_COLOURS.light.stroke}"`);
    expect(svg).toContain(`fill="${RETIRED_PLACEHOLDER_COLOURS.light.fill}"`);
    expect(svg).toContain('stroke-width="1.5"');
    expect(svg).toContain('stroke-dasharray="6 4"');
    expect(texts(svg)).toEqual([
      'Q&amp;A Board',
      'No longer supported in livehuddle',
      'Ask &lt;us&gt;',
    ]);
    // In the element's box: the outline inset by half its stroke.
    expect(svg).toContain('<rect x="100.75" y="50.75" width="318.5" height="218.5"');
  });

  it('follows the paper', () => {
    const svg = svgRetiredElement(retired('estimate'), 'dark');
    expect(svg).toContain(`fill="${RETIRED_PLACEHOLDER_COLOURS.dark.fill}"`);
    expect(svg).toContain(`fill="${RETIRED_PLACEHOLDER_COLOURS.dark.ink}"`);
  });

  it('writes its words in the given face', () => {
    expect(svgRetiredElement(retired('estimate'), 'light', 'Caveat')).toContain(
      '<g font-family="Caveat">',
    );
  });
});

describe('a retired element in the export', () => {
  it('draws the placeholder in place of its stored face, colours and label', () => {
    const el = retired('session-button', {
      label: 'Lunch?',
      session: { tool: 'poll', question: 'Where?' },
      fillColor: '#ff0000',
      strokeColor: '#00ff00',
    });
    const svg = svgBoxed(el);
    expect(texts(svg)).toEqual(['Poll', 'No longer supported in livehuddle', 'Lunch?']);
    expect(svg).not.toContain('#ff0000');
    expect(svg).not.toContain('#00ff00');
    expect(svg).not.toContain('Where?');
  });

  it('keeps its turn and its opacity', () => {
    const svg = svgBoxed(retired('agenda', { rotation: 15, opacity: 0.5 }));
    expect(svg).toMatch(/^<g opacity="0.5" transform="rotate\(15 260 160\)">/);
  });

  it('names a kind livehuddle never had an Unknown Element', () => {
    expect(texts(svgBoxed(retired('hologram')))).toEqual([
      'Unknown Element',
      'No longer supported in livehuddle',
    ]);
  });

  it('draws the same card in a whole-tab render, on dark paper too', () => {
    const svg = renderElementsToSvg(
      { id: 't', name: 'T', elements: [retired('roll-call')] },
      { background: '#0d121a' },
    );
    expect(svg).toContain('>Roll Call<');
    expect(svg).toContain(`fill="${RETIRED_PLACEHOLDER_COLOURS.dark.fill}"`);
  });

  it('is rasterised from the SVG for the PNG and PDF, which have no drawer for it', () => {
    expect(boxedNeedsSvgRaster(retired('temperature') as BoxedElement)).toBe(true);
  });
});
