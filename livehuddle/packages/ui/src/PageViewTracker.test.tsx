import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

import { reportPageView, resetPageViewTrackerForTests } from './PageViewTracker';

// The tracker itself is @liveworkspace/ui's, tested there; this checks it is bound to this product's
// page-view paths (@livehuddle/api-schema's pageViewPath).
beforeEach(() => resetPageViewTrackerForTests());

describe('reportPageView', () => {
  it("reports this product's normalised path", () => {
    const track = vi.fn();
    reportPageView(track, '/document/3f2b8c1e-9a4d-4e7b-8c21-0d5e6f7a8b9c');
    expect(track).toHaveBeenCalledWith('Page', 'View', '/document');
  });

  it('sends nothing for a path it cannot express', () => {
    const track = vi.fn();
    reportPageView(track, '/help/some thing');
    expect(track).not.toHaveBeenCalled();
  });
});
