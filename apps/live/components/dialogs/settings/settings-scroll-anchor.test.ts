// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  applyScrollAnchor,
  captureScrollAnchor,
  SETTINGS_ROW_ATTRIBUTE,
} from './settings-scroll-anchor';

// jsdom lays nothing out, so each element reports the viewport rect a real
// browser would, derived from its content-space position and the scroll.
function pane(rows: { key: string; top: number; height: number }[], scrollTop = 0) {
  const PANE_TOP = 100;
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ top: PANE_TOP, bottom: PANE_TOP + 400 }) as DOMRect;
  for (const r of rows) {
    const row = document.createElement('div');
    row.setAttribute(SETTINGS_ROW_ATTRIBUTE, r.key);
    row.getBoundingClientRect = () => {
      const top = PANE_TOP + r.top - el.scrollTop;
      return { top, bottom: top + r.height } as DOMRect;
    };
    el.appendChild(row);
  }
  el.scrollTop = scrollTop;
  return el;
}

const ROWS = [
  { key: 'a', top: 0, height: 120 },
  { key: 'b', top: 140, height: 200 },
  { key: 'c', top: 360, height: 90 },
];

describe('captureScrollAnchor', () => {
  it('keeps no anchor at the very top', () => {
    expect(captureScrollAnchor(pane(ROWS, 0))).toBeNull();
  });

  it('anchors on the topmost row still showing, even partly', () => {
    // Row b spans 140..340; scrolled 200 in, its top sits 60px above the edge.
    expect(captureScrollAnchor(pane(ROWS, 200))).toEqual({ rowKey: 'b', offset: -60 });
  });

  it('skips rows scrolled wholly out of view', () => {
    expect(captureScrollAnchor(pane(ROWS, 350))).toEqual({ rowKey: 'c', offset: 10 });
  });
});

describe('applyScrollAnchor', () => {
  it('brings the anchored row back to the same height', () => {
    const el = pane(ROWS, 0);
    expect(applyScrollAnchor(el, { rowKey: 'b', offset: -60 })).toBe(true);
    expect(el.scrollTop).toBe(200);
  });

  it('follows the row when a reflow has moved it', () => {
    // A narrower window wraps footnotes, so b now starts at 260, not 140.
    const el = pane(
      [
        { key: 'a', top: 0, height: 240 },
        { key: 'b', top: 260, height: 300 },
      ],
      0,
    );
    applyScrollAnchor(el, { rowKey: 'b', offset: -60 });
    expect(el.scrollTop).toBe(320);
  });

  it('leaves the pane alone when the row is gone', () => {
    const el = pane(ROWS, 0);
    expect(applyScrollAnchor(el, { rowKey: 'gone', offset: 0 })).toBe(false);
    expect(el.scrollTop).toBe(0);
  });
});
