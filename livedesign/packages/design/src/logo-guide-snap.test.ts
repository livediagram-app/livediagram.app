import { describe, expect, it } from 'vitest';
import { logoGuides } from './logo-page';
import {
  logoGuideCrossings,
  logoGuideShapes,
  logoGuideSnapTargets,
  snapToGuideTargets,
  snapToLogoGuides,
} from './logo-guide-snap';

// docs/specs/007-editor/logo-pages.md "Construction guides": snapping to the guides shown.
const g = logoGuides({ x: 0, y: 0, width: 1024, height: 1024 });
const all = () => true;

describe('snapToLogoGuides', () => {
  it('prefers where guides cross: the centre', () => {
    expect(snapToLogoGuides(g, all, { x: 518, y: 507 }, 10)).toEqual({ x: 512, y: 512 });
  });

  it('lands on the nearest guide line where no crossing is close', () => {
    const p = snapToLogoGuides(g, (part) => part === 'centre', { x: 516, y: 300 }, 10);
    expect(p).toEqual({ x: 512, y: 300 });
  });

  it('lands on a circle', () => {
    const p = snapToLogoGuides(g, (part) => part === 'circles', { x: 512 + 262, y: 520 }, 12)!;
    expect(Math.hypot(p.x - 512, p.y - 512)).toBeCloseTo(256, 5);
  });

  it('a circle meeting the centre line is a crossing', () => {
    const shows = (part: string) => part === 'circles' || part === 'centre';
    const p = snapToLogoGuides(g, shows, { x: 515, y: 107 }, 10)!;
    expect(p.x).toBeCloseTo(512);
    expect(p.y).toBeCloseTo(512 - 409.6);
  });

  it('ignores hidden parts and anything out of reach', () => {
    expect(snapToLogoGuides(g, () => false, { x: 512, y: 512 }, 10)).toBeNull();
    expect(snapToLogoGuides(g, all, { x: 470, y: 330 }, 2)).toBeNull();
  });

  it('stays cheap with every part shown', () => {
    const shapes = logoGuideShapes(g, all);
    expect(logoGuideCrossings(shapes).length).toBeGreaterThan(50);
    // Prepared once, as the editor does per page: a snap is then a scan of the crossings.
    const targets = logoGuideSnapTargets(g, all);
    const t = performance.now();
    // About 11 us a snap at rest; unprepared it was about 1.75 ms, so 1000 would take 1.75 s.
    for (let i = 0; i < 1000; i++) snapToGuideTargets(targets, { x: i, y: 300 }, 10);
    expect(performance.now() - t).toBeLessThan(500);
  });
});
