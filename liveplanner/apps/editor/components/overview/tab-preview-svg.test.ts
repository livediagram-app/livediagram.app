// A tab tile's preview window and fit (docs/specs/026-plan/plan-overview.md "Tabs").
import { describe, expect, it } from 'vitest';
import { EXPORT_PADDING, type Tab } from '@liveplanner/project';
import { PREVIEW_H, PREVIEW_W, isWindowed, previewFit, previewTabOf } from './tab-preview-svg';
import { boardTab } from './overview-fixtures.test-helpers';

describe('previewTabOf', () => {
  it('sizes a Board tab’s board to the window, so its export is exactly the window', () => {
    const tab = previewTabOf(boardTab('b', 'Triage'));
    expect(tab.elements[0]).toMatchObject({
      x: 0,
      y: 0,
      width: PREVIEW_W - EXPORT_PADDING * 2,
      height: PREVIEW_H - EXPORT_PADDING * 2,
    });
  });

  it('leaves any other tab as it is', () => {
    const form = { id: 'f', name: 'Form', kind: 'form', elements: [] } as unknown as Tab;
    expect(previewTabOf(form)).toBe(form);
    const blank = { id: 'e', name: 'Board', kind: 'board', elements: [] } as unknown as Tab;
    expect(previewTabOf(blank)).toBe(blank);
  });
});

describe('previewFit', () => {
  it('fills a 16:10 tile with the window, from the top left', () => {
    expect(previewFit({ w: 1440, h: 2400 }, { w: 288, h: 180 }, false)).toEqual({
      scale: 0.2,
      x: 0,
      y: 0,
    });
  });

  it('centres a drawing narrower than the window', () => {
    const fit = previewFit({ w: 720, h: 1800 }, { w: 288, h: 180 }, false);
    expect(fit.scale).toBe(0.2);
    expect(fit.x).toBe(72);
    expect(fit.y).toBe(0);
  });

  it('fits a drawing whole when asked', () => {
    const fit = previewFit({ w: 2880, h: 900 }, { w: 288, h: 180 }, true);
    expect(fit.scale).toBe(0.1);
    expect(fit.y).toBe(45);
  });

  it('draws nothing into a box not measured yet', () => {
    expect(previewFit({ w: 100, h: 100 }, { w: 0, h: 0 }, false).scale).toBe(0);
  });
});

describe('isWindowed', () => {
  it('windows the Plan kinds and fits anything else', () => {
    expect(isWindowed(boardTab('b', 'B'))).toBe(true);
    const drawing: Tab = { id: 'x', name: 'X', elements: [] };
    expect(isWindowed(drawing)).toBe(false);
  });
});
