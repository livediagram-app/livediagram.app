// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { LaidOutPage } from '@livedesign/design';
import { photoFocusOf, pressIsChrome } from './photo-focus';

const page = (id: string, kind: string, x: number, width = 100, height = 100) =>
  ({ id, kind, rect: { x, y: 0, width, height } }) as unknown as LaidOutPage;

describe('photoFocusOf', () => {
  const pages = [
    page('a', 'photo', 0),
    page('b', 'logo', 200),
    page('c', 'photo', 400, 1000, 1000),
  ];

  it('takes the photo page that fills most of the view', () => {
    expect(photoFocusOf(pages, { x: 300, y: 0, width: 500, height: 500 }, null)).toBe('c');
    expect(photoFocusOf(pages, { x: -10, y: -10, width: 150, height: 150 }, null)).toBe('a');
  });

  it('keeps the pressed one while it is in view', () => {
    const view = { x: 50, y: 0, width: 700, height: 500 };
    expect(photoFocusOf(pages, view, null)).toBe('c');
    expect(photoFocusOf(pages, view, 'a')).toBe('a');
    expect(photoFocusOf(pages, { x: 500, y: 0, width: 100, height: 100 }, 'a')).toBe('c');
  });

  it('takes no page from a sliver at the edge, nor without photo pages or a view', () => {
    expect(photoFocusOf(pages, { x: 95, y: 0, width: 200, height: 200 }, null)).toBeNull();
    expect(
      photoFocusOf([page('b', 'logo', 0)], { x: 0, y: 0, width: 10, height: 10 }, null),
    ).toBeNull();
    expect(photoFocusOf(pages, null, 'a')).toBeNull();
  });
});

describe('pressIsChrome', () => {
  it('keeps a press on a tool or a panel over a page the control’s, and a press on the canvas the page’s', () => {
    document.body.innerHTML = `
      <main id="canvas"><svg id="art"></svg>
        <div data-floating-panel><div role="toolbar"><button id="move"><span id="icon"></span></button></div>
          <div id="panel-gap"></div></div>
        <div role="menu"><div id="item"></div></div>
      </main>`;
    const at = (id: string) => document.getElementById(id);
    expect(pressIsChrome(at('move'))).toBe(true);
    expect(pressIsChrome(at('icon'))).toBe(true);
    expect(pressIsChrome(at('panel-gap'))).toBe(true);
    expect(pressIsChrome(at('item'))).toBe(true);
    expect(pressIsChrome(at('canvas'))).toBe(false);
    expect(pressIsChrome(at('art'))).toBe(false);
    expect(pressIsChrome(null)).toBe(false);
  });
});
