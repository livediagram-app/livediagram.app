import { describe, expect, it } from 'vitest';
import { isRoadmapPath, roadmapFromPath } from './roadmap-path';

// docs/specs/026-plan/public-roadmap.md "Domain language": /roadmap/<plan id>/<code>.
const CODE = 'lpr_AbCdEfGhIjKlMnOpQrStUv';

describe('roadmap paths', () => {
  it('knows its own paths', () => {
    expect(isRoadmapPath('/roadmap')).toBe(true);
    expect(isRoadmapPath(`/roadmap/p/${CODE}`)).toBe(true);
    expect(isRoadmapPath('/roadmaps')).toBe(false);
    expect(isRoadmapPath('/features/roadmap')).toBe(false);
  });

  it('reads the plan and the code, with or without a trailing slash', () => {
    expect(roadmapFromPath(`/roadmap/plan-1/${CODE}`)).toEqual({ planId: 'plan-1', code: CODE });
    expect(roadmapFromPath(`/roadmap/plan-1/${CODE}/`)).toEqual({ planId: 'plan-1', code: CODE });
  });

  it.each([
    '/roadmap/placeholder',
    `/roadmap/plan-1/${CODE}/votes`,
    '/roadmap/plan-1/nope',
    `/roadmap/bad%20id/${CODE}`,
  ])('reads nothing from %s', (path) => {
    expect(roadmapFromPath(path)).toBeNull();
  });
});
