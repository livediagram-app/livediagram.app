// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StickyElement } from '@livediagram/document';
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

const shown = (el: StickyElement) =>
  render(
    <div style={{ color: 'rgb(241, 245, 249)' }}>
      {renderLabel(
        el,
        el.label ?? '',
        'sm',
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
