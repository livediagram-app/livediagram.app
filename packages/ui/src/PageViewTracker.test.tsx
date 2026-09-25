// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PageViewTracker, reportPageView, resetPageViewTrackerForTests } from './PageViewTracker';

let pathname = '/';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

function navigate(to: string) {
  pathname = to.split('?')[0]!;
  window.history.pushState(null, '', to);
}

beforeEach(() => {
  resetPageViewTrackerForTests();
  navigate('/');
});

describe('reportPageView', () => {
  it('reports the normalised path', () => {
    const track = vi.fn();
    reportPageView(track, '/diagram/3f2b8c1e-9a4d-4e7b-8c21-0d5e6f7a8b9c');
    expect(track).toHaveBeenCalledWith('Page', 'View', '/diagram');
  });

  it('counts the same page twice in a row once, but a return after leaving again', () => {
    const track = vi.fn();
    reportPageView(track, '/faq');
    reportPageView(track, '/faq/');
    reportPageView(track, '/help');
    reportPageView(track, '/faq');
    expect(track.mock.calls.map((c) => c[2])).toEqual(['/faq', '/help', '/faq']);
  });

  it('sends nothing for a path it cannot express', () => {
    const track = vi.fn();
    reportPageView(track, '/help/some thing');
    expect(track).not.toHaveBeenCalled();
  });

  it('never throws into the host', () => {
    const track = vi.fn(() => {
      throw new Error('boom');
    });
    expect(() => reportPageView(track, '/')).not.toThrow();
  });
});

describe('PageViewTracker', () => {
  it('reports the real location on mount and on each path change, not on a query change', () => {
    const track = vi.fn();
    navigate('/help/canvas/the-canvas');
    const { rerender } = render(<PageViewTracker track={track} />);
    navigate('/help/canvas/the-canvas?q=1');
    rerender(<PageViewTracker track={track} />);
    navigate('/help/tabs');
    rerender(<PageViewTracker track={track} />);
    expect(track.mock.calls.map((c) => c[2])).toEqual(['/help/canvas/the-canvas', '/help/tabs']);
  });
});
