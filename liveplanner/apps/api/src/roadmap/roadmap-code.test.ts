import { describe, expect, it } from 'vitest';
import { ROADMAP_CODE_PATTERN } from '@liveplanner/api-schema';
import { newRoadmapCode, publicVoterId } from './roadmap-code';

// docs/specs/026-plan/public-roadmap.md "Domain language" and "Upvotes".
describe('roadmap codes and voter ids', () => {
  it('makes a fresh lpr_ code each time', () => {
    const codes = new Set(Array.from({ length: 50 }, () => newRoadmapCode()));
    expect(codes.size).toBe(50);
    for (const c of codes) expect(c).toMatch(ROADMAP_CODE_PATTERN);
  });

  it('names a browser by a salted hash, the same each time on one plan and different on another', async () => {
    const a = await publicVoterId('plan-1', 'browser-abc-123');
    expect(a).toMatch(/^rv:[0-9a-f]{24}$/);
    expect(await publicVoterId('plan-1', 'browser-abc-123')).toBe(a);
    expect(await publicVoterId('plan-2', 'browser-abc-123')).not.toBe(a);
    expect(a).not.toContain('browser-abc-123');
  });
});
