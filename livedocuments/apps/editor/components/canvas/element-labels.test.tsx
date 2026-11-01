// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BoxedElement, ShapeElement, StickyElement } from '@livedocuments/document';
import { renderLabel } from './element-labels';

// A note's words take the colour the element view sets (its own textColor, else the note default),
// so a note coloured on purpose (a dark preset, an imported note) reads in its own ink.
const note = (over: Partial<StickyElement> = {}): StickyElement => ({
  id: 's',
  type: 'sticky',
  x: 0,
  y: 0,
  width: 160,
  height: 120,
  label: 'Words',
  ...over,
});

const shown = (el: BoxedElement) =>
  render(
    <div style={{ color: 'rgb(241, 245, 249)' }}>
      {renderLabel(
        el,
        el.label ?? '',
        el.textSize ?? 'sm',
        'center',
        'middle',
        14,
        false,
        () => {},
        () => {},
        false,
      )}
    </div>,
  ).container;

describe('a note label', () => {
  it("takes the element's ink rather than a fixed colour", () => {
    expect(shown(note()).querySelector('.text-amber-950')).toBeNull();
  });

  it('keeps that ink through formatted runs', () => {
    const el = note({ richText: [{ text: 'Wor', bold: true }, { text: 'ds' }] });
    expect(shown(el).querySelector('.text-amber-950')).toBeNull();
  });
});

// docs/specs/007-editor/pages-mode.md "Sizes": a shape a page re-fit scaled draws its words at its
// size times its scale, plain or formatted, so they stay inside it.
describe('a re-fitted shape label', () => {
  const button = (over: Partial<ShapeElement> = {}): ShapeElement => ({
    id: 'b',
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 110,
    height: 26,
    label: 'Continue',
    textSize: 16,
    ...over,
  });
  const fontSizes = (el: ShapeElement) =>
    [...shown(el).querySelectorAll<HTMLElement>('[style*="font-size"]')].map(
      (n) => n.style.fontSize,
    );

  it('draws at its size times its scale', () => {
    expect(fontSizes(button())).toContain('16px');
    expect(fontSizes(button({ textScale: 0.5 }))).toContain('8px');
    expect(fontSizes(button({ textScale: 0.5 }))).not.toContain('16px');
  });

  it('scales its formatted runs with it', () => {
    const rich = button({
      textScale: 0.5,
      richText: [{ text: 'Conti', bold: true }, { text: 'nue' }],
    });
    expect(fontSizes(rich)).toContain('8px');
    expect(fontSizes(rich)).not.toContain('16px');
  });
});
