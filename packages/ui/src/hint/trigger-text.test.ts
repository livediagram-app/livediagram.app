// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { accessibleNameOf, hasVisibleText, nameSaysLabel } from './trigger-text';

const html = (markup: string): HTMLElement => {
  document.body.innerHTML = markup;
  return document.body.firstElementChild as HTMLElement;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('hasVisibleText', () => {
  it('is false for an icon-only control', () => {
    expect(
      hasVisibleText(html('<button aria-label="Zoom in"><svg aria-hidden="true"></svg></button>')),
    ).toBe(false);
  });

  it('is true for a control that shows its own words', () => {
    expect(hasVisibleText(html('<button>Keep results</button>'))).toBe(true);
  });

  it('reads rendered text when the engine lays out, so hidden captions do not count', () => {
    const el = html('<button><span>Rectangle</span></button>');
    Object.defineProperty(el, 'innerText', { value: '', configurable: true });
    expect(hasVisibleText(el)).toBe(false);
  });

  it('ignores visually hidden and aria-hidden text without layout', () => {
    expect(
      hasVisibleText(
        html('<button><span class="sr-only">Zoom</span><span aria-hidden="true">+</span></button>'),
      ),
    ).toBe(false);
  });
});

describe('accessibleNameOf', () => {
  it('prefers aria-label', () => {
    expect(accessibleNameOf(html('<button aria-label="Zoom in">+</button>'))).toBe('Zoom in');
  });

  it('then aria-labelledby', () => {
    document.body.innerHTML = '<span id="a">Fit</span><button aria-labelledby="a">x</button>';
    expect(accessibleNameOf(document.querySelector('button')!)).toBe('Fit');
  });

  it('then the text content, squeezed', () => {
    expect(accessibleNameOf(html('<p>  Untitled \n token </p>'))).toBe('Untitled token');
  });
});

describe('nameSaysLabel', () => {
  it('accepts a name that contains the label, case aside', () => {
    expect(
      nameSaysLabel(
        'Time since the presentation started 12:04',
        'time since the presentation started',
      ),
    ).toBe(true);
  });

  it('rejects a name that does not', () => {
    expect(nameSaysLabel('Make this a hotspot', 'Hotspot colour')).toBe(false);
  });
});
