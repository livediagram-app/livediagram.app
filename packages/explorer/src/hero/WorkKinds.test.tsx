import { render, screen, within } from '@testing-library/react';
import { BRAND_APPS } from '@liveworkspace/brand';
import { type App } from '@liveworkspace/index-client';
import { APP_NAMES as APPS } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { WorkKinds, defaultTemplateHref } from './WorkKinds';
import { WORK_KINDS, WORK_KINDS_PER_APP, workTiles } from './work-kinds';

// What Home's hero pictures (liveworkspace/docs/specs/004-index/one-explorer.md "What you can make, on Home's hero"): each app's own
// kinds, one per app under All, every set built the same way, each tile in its own app's colours and starting its
// template.

// livehuddle is registered but held until launch (no Explorer shows it), so it has no set yet.
const EXPECTED: Partial<Record<App, { labels: string[]; templates: string[] }>> = {
  livediagram: {
    labels: ['Flowchart', 'Mind Map', 'Whiteboard', 'Workshop'],
    templates: ['flowchart', 'mindmap', 'whiteboard', 'blank-session'],
  },
  liveplanner: {
    labels: ['Board', 'Sheet', 'Dashboard', 'Form'],
    templates: ['kanban', 'blank-spreadsheet', 'project-planner', 'blank-form'],
  },
  livedocuments: {
    labels: ['Article', 'Slide Deck', 'Infographic', 'Poster'],
    templates: ['blank-article', 'blank-slide-deck', 'blank-infographic', 'event-poster'],
  },
  livedesign: {
    labels: ['Logo', 'App Wireframe', 'Web Wireframe', 'Photo'],
    templates: ['blank-logo', 'blank-wireframe-phone', 'blank-wireframe-browser', 'photo-edit'],
  },
};

const tilesOf = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-work-kind]')];

/** A set's shape, with its words and colours left out: what must match from app to app. */
function shape(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  for (const el of clone.querySelectorAll('*')) {
    for (const name of ['href', 'aria-label', 'title', 'style', 'data-work-kind', 'data-work-app'])
      el.removeAttribute(name);
    // A picture's own drawing differs by kind; its frame does not.
    if (el.localName === 'svg') while (el.childNodes.length > 1) el.removeChild(el.lastChild!);
    if (el.localName === 'span' && !el.children.length) el.textContent = '';
  }
  clone.removeAttribute('data-work-kinds');
  return clone.outerHTML;
}

const href = (app: App, template: string) => `https://${app}.test/new?template=${template}`;

describe('WorkKinds', () => {
  it.each(APPS)('shows %s’s own kinds, each starting its template in its app', (app) => {
    const { container } = render(<WorkKinds app={app} all={false} templateHref={href} />);
    const set = screen.getByRole('region', { name: 'What you can make' });
    expect(set.getAttribute('data-work-kinds')).toBe(app);
    const tiles = tilesOf(container);
    expect(tiles.map((t) => t.textContent)).toEqual(EXPECTED[app]!.labels);
    expect(tiles.map((t) => t.getAttribute('data-work-app'))).toEqual(Array(4).fill(app));
    expect(tiles.map((t) => t.getAttribute('href'))).toEqual(
      EXPECTED[app]!.templates.map((t) => href(app, t)),
    );
    for (const [i, label] of EXPECTED[app]!.labels.entries())
      expect(within(set).getByRole('link', { name: `New ${label}` })).toBe(tiles[i]);
    // Each draws in its own app's colours, set on the tile for the picture's `brand` classes.
    for (const t of tiles) {
      expect(t.style.getPropertyValue('--wk-500')).toBe(BRAND_APPS[app].ramp[500]);
      expect(t.querySelector('svg.lw-work-art')?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('builds every app’s set, and All’s, the same way: one layout, size and spacing', () => {
    const shapes = [...APPS.map((app) => [app, false] as const), [APPS[0]!, true] as const].map(
      ([app, all]) => {
        const { container, unmount } = render(
          <WorkKinds app={app} all={all} templateHref={href} />,
        );
        const s = shape(container.firstElementChild as HTMLElement);
        unmount();
        return s;
      },
    );
    expect(new Set(shapes).size).toBe(1);
    for (const app of APPS) expect(WORK_KINDS[app]).toHaveLength(WORK_KINDS_PER_APP);
  });

  it('shows one per app under All, each in that app’s colours and named by its kind', () => {
    const { container } = render(<WorkKinds app="liveplanner" all templateHref={href} />);
    const tiles = tilesOf(container);
    expect(tiles.map((t) => t.getAttribute('data-work-app'))).toEqual([...APPS]);
    expect(tiles.map((t) => t.textContent)).toEqual(['Canvas', 'Plan', 'Document', 'Design']);
    expect(tiles.map((t) => t.getAttribute('href'))).toEqual(
      APPS.map((app) => href(app, EXPECTED[app]!.templates[0]!)),
    );
    expect(tiles[0]!.getAttribute('aria-label')).toBe('New Canvas in livediagram');
    expect(tiles.map((t) => t.style.getPropertyValue('--wk-500'))).toEqual(
      APPS.map((app) => BRAND_APPS[app].ramp[500]),
    );
  });

  it('starts the host app’s kinds on its own New route by default, and another app’s on its site', () => {
    expect(defaultTemplateHref('livedesign')('livedesign', 'blank-logo')).toBe(
      '/new?template=blank-logo',
    );
    expect(defaultTemplateHref('livedesign')('liveplanner', 'kanban')).toBe(
      'https://www.liveplanner.app/new?template=kanban',
    );
    const { container } = render(<WorkKinds app="livedesign" all />);
    expect(tilesOf(container)[3]!.getAttribute('href')).toBe('/new?template=blank-logo');
  });

  it('draws a kind the host cannot start as a picture, not a link', () => {
    const { container } = render(
      <WorkKinds
        app="livedesign"
        all={false}
        templateHref={(app, t) => (t === 'photo-edit' ? null : href(app, t))}
      />,
    );
    const tiles = tilesOf(container);
    expect(tiles.map((t) => t.localName)).toEqual(['a', 'a', 'a', 'div']);
    expect(tiles[3]!.getAttribute('role')).toBe('img');
    expect(tiles[3]!.getAttribute('aria-label')).toBe('Photo');
  });

  it('draws each picture without a raw colour, so the app’s ramp and the dark look reach every part', () => {
    for (const app of APPS) {
      const { container, unmount } = render(
        <WorkKinds app={app} all={false} templateHref={href} />,
      );
      for (const el of container.querySelectorAll('svg *')) {
        expect(el.getAttribute('fill')).toBeNull();
        expect(el.getAttribute('stroke')).toBeNull();
      }
      unmount();
    }
    expect(workTiles('livediagram', true)).toHaveLength(WORK_KINDS_PER_APP);
  });

  it('keeps each set small: a bounded count of SVG elements, drawn quickly', () => {
    const counts: number[] = [];
    const started = performance.now();
    for (const app of APPS) {
      const { container, unmount } = render(
        <WorkKinds app={app} all={false} templateHref={href} />,
      );
      counts.push(container.querySelectorAll('svg *').length);
      unmount();
    }
    const elapsed = performance.now() - started;
    // The heaviest set today (livediagram's, with the whiteboard's dot grid) draws 121; a picture that grows
    // past this budget is a picture to simplify, as the hero draws on every Home.
    for (const n of counts) expect(n).toBeLessThan(200);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('a held app', () => {
  it('has no tile under All until it launches: one per listed app only', () => {
    expect(workTiles('livediagram', true).map((t) => t.app)).not.toContain('livehuddle');
    expect(WORK_KINDS.livehuddle).toEqual([]);
  });
});
