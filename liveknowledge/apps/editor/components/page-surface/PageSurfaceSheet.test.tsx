// @vitest-environment jsdom

// The page's box (docs/specs/030-knowledgebase/page-surface.md "What a page looks like"): it paints nothing, and its
// breadcrumb must be pressable at every width. The writing's paper (ArticleFlows) takes a press anywhere on the page,
// the top margin included, so the box stands over it and lets every press through but the breadcrumb's.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LaidOutPage } from '@liveknowledge/document';

vi.mock('@/components/page-tree/PageBreadcrumb', () => ({
  PageBreadcrumb: () => (
    <nav data-page-breadcrumb="" className="pointer-events-auto">
      <a href="#t=p1">Parent Page</a>
    </nav>
  ),
}));

import { PageSurfaceSheet } from './PageSurfaceSheet';

afterEach(cleanup);

const page = {
  id: 'page-1',
  orientation: 'portrait',
  kind: 'article',
  size: 'fit',
  fit: { width: 856, height: 270 },
  index: 0,
  rect: { x: -428, y: 0, width: 856, height: 270 },
} as unknown as LaidOutPage;

const sheet = (over: Partial<Parameters<typeof PageSurfaceSheet>[0]> = {}) =>
  render(
    <PageSurfaceSheet
      page={page}
      zoom={1}
      margin={48}
      topMargin={72}
      bare={false}
      mobile={false}
      {...over}
    />,
  ).container.querySelector<HTMLElement>('[data-page-surface]')!;

describe('PageSurfaceSheet', () => {
  it('stands over the writing’s paper and takes no press itself, so only the breadcrumb is pressed', () => {
    const box = sheet();
    expect(box.className).toContain('z-[1]');
    expect(box.className).toContain('pointer-events-none');
    const crumb = box.querySelector<HTMLElement>('[data-page-breadcrumb]')!;
    expect(crumb.className).toContain('pointer-events-auto');
    // The page the engine finds itself on.
    expect(box.getAttribute('data-page-id')).toBe('page-1');
    expect(box.getAttribute('data-page-kind')).toBe('article');
  });

  it('lines the breadcrumb up with the column, in the top margin above the Title', () => {
    const row = sheet().querySelector<HTMLElement>('[data-page-title-row]')!;
    expect(row.style.left).toBe('48px');
    expect(row.style.right).toBe('48px');
    const top = parseFloat(row.style.top);
    const height = parseFloat(row.style.height);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top + height).toBeLessThan(72);
  });

  it('is the stored page’s size: as short as its writing', () => {
    const box = sheet();
    expect(box.style.height).toBe('270px');
    expect(box.style.width).toBe('856px');
  });

  it.each([{ bare: true }, { mobile: true }])('draws no breadcrumb for %o', (over) => {
    expect(sheet(over).querySelector('[data-page-breadcrumb]')).toBeNull();
  });
});
