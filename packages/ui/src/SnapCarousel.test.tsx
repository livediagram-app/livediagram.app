// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SnapCarousel } from './SnapCarousel';

describe('SnapCarousel', () => {
  // jsdom lays nothing out: no scrolling, no resize observer.
  beforeAll(() => {
    Element.prototype.scrollTo = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  // A card's sr-only text is absolutely placed. Unless the track is positioned, that text is
  // placed against the page instead, so a card scrolled off the right widened the whole landing
  // page into a sideways scroll on desktop.
  it('keeps its cards inside a positioned track, so nothing escapes its clip', () => {
    const { container } = render(
      <SnapCarousel heading="Agile" label="Agile" itemsKey="agile" itemClassName="">
        <li>
          Card <span className="sr-only">template</span>
        </li>
      </SnapCarousel>,
    );
    const track = container.querySelector('ul')!;
    expect(track.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['relative', 'overflow-x-auto']),
    );
  });
});
