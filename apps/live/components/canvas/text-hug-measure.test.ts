// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createText, type TextElement } from '@livediagram/document';
import { labelRuns, measureDrawnText, measureTextHug } from './text-hug-measure';

// The DOM measure behind a whiteboard text box's hug (docs/specs/023-draw-mode/draw-mode.md
// "Text boxes"). jsdom lays nothing out, so these pin what the measurer lays in and how it is
// sized; the real numbers are proven in a browser.
const measurer = () => document.querySelector<HTMLElement>('[data-text-hug-measurer]')!;

function stubRect(width: number, height: number) {
  return vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ width, height } as DOMRect);
}

const hello = (patch: Partial<TextElement> = {}): TextElement => ({
  ...createText(0, 0),
  label: 'Hello',
  textSize: 'sm',
  ...patch,
});

afterEach(() => vi.restoreAllMocks());

describe('measureTextHug', () => {
  it('lays a label in as its runs, each a styled span, at the label px', () => {
    stubRect(35, 17.5);
    const el = hello({ textBold: true, textScale: 2 });
    const size = measureTextHug(
      el,
      [{ text: 'Hel' }, { text: 'lo', italic: true }],
      'serif',
    )(472, false);
    expect(size).toEqual({ width: 35, height: 17.5 });
    const node = measurer();
    expect(node.style.fontSize).toBe('28px');
    expect(node.style.fontFamily).toBe('serif');
    expect(node.style.width).toBe('max-content');
    expect(node.style.maxWidth).toBe('472px');
    const spans = [...node.querySelectorAll('span')];
    expect(spans.map((s) => s.textContent)).toEqual(['Hel', 'lo']);
    expect(spans[0]!.style.fontWeight).toBe('700');
    expect(spans[1]!.style.fontStyle).toBe('italic');
  });

  it('lays a set width out at exactly that width', () => {
    stubRect(0, 0);
    measureTextHug(hello(), labelRuns(hello()), undefined)(200, true);
    expect(measurer().style.width).toBe('200px');
  });

  it('copies the live editor as it shows, and holds one line for an empty one', () => {
    stubRect(0, 0);
    const editor = document.createElement('div');
    editor.innerHTML = 'Line one\n<br data-rt-render-nl="">';
    measureTextHug(hello(), editor, undefined)(472, false);
    expect(measurer().innerHTML).toBe('Line one\n<br data-rt-render-nl="">');
    expect(editor.childNodes).toHaveLength(2);
    editor.innerHTML = '<br>';
    measureTextHug(hello(), editor, undefined)(472, false);
    expect(measurer().textContent).toBe('\u200b');
  });

  it('keeps one measurer, whatever measures', () => {
    stubRect(0, 0);
    measureTextHug(hello(), labelRuns(hello()), undefined)(10, true);
    measureTextHug(hello(), labelRuns(hello()), undefined)(10, true);
    expect(document.querySelectorAll('[data-text-hug-measurer]')).toHaveLength(1);
  });
});

describe('measureDrawnText', () => {
  it("measures in the element's own face, else the tab's", () => {
    stubRect(0, 0);
    measureDrawnText('caveat')(hello())(10, true);
    const tabFace = measurer().style.fontFamily;
    expect(tabFace).toContain('Caveat');
    measureDrawnText('caveat')(hello({ font: 'inter' }))(10, true);
    expect(measurer().style.fontFamily).not.toBe(tabFace);
  });

  it('draws rich runs when the label has them', () => {
    expect(labelRuns(hello({ richText: [{ text: 'Hi', bold: true }] }))).toEqual([
      { text: 'Hi', bold: true },
    ]);
    expect(labelRuns(hello({ label: 'Plain' }))).toEqual([{ text: 'Plain' }]);
  });
});
