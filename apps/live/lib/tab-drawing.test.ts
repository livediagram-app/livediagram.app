import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@liveplanner/document';
import { blankQuestion, type FormDefinition } from '@liveplanner/forms';
import { renderTabToSvg } from './export-tab';
import { renderTabDrawingSvg, tabDrawingFontIdsOf } from './tab-drawing';

// docs/specs/009-elements/tab-window.md "The drawing": every mode is drawn, a Form tab as its form.

const box = (id: string, label: string, at: { x: number; y: number }): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  ...at,
  width: 120,
  height: 60,
  label,
});
const tab = (extra: Partial<Tab>): Tab => ({ id: 't', name: 'T', elements: [], ...extra });

const form: FormDefinition = {
  v: 1,
  heading: 'Team Survey',
  sections: [
    {
      id: 's-1',
      title: '',
      questions: [{ ...blankQuestion('short', 'q-1'), prompt: 'Your Role' }],
    },
  ],
};

describe('renderTabDrawingSvg', () => {
  it('draws a canvas tab as its canvas', () => {
    const t = tab({ elements: [box('a', 'Checkout', { x: 0, y: 0 })] });
    expect(renderTabDrawingSvg(t)).toBe(renderTabToSvg(t));
  });

  it('draws a Form tab as its form on its look, though no element is on it', () => {
    const svg = renderTabDrawingSvg(tab({ kind: 'form', form, theme: 'ocean' }));
    expect(svg).toContain('Team Survey');
    expect(svg).toContain('Your Role');
    expect(svg).toContain('Submit');
  });

  it('draws a Form tab whose form cannot be read as its canvas', () => {
    const t = tab({ kind: 'form', form: [] as never });
    expect(renderTabDrawingSvg(t)).toBe(renderTabToSvg(t));
  });
});

describe('tabDrawingFontIdsOf', () => {
  it("names a form's typeface and its elements'", () => {
    expect(tabDrawingFontIdsOf(tab({ kind: 'form', form, font: 'marker' }))).toContain('marker');
  });
});
