import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The dashboard's stacks deal in from 20px to the right (timeline-motion.css). On a phone that spill
// widened the page by a few pixels, and the fixed StickyWindowBar (inset-x-0) then sized itself to
// the wider page and held it there, so the whole dashboard slid sideways. The views' wrapper clips
// horizontal overflow so the deal-in never reaches the page.
const read = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8');

describe('the dashboard views wrapper', () => {
  it('clips sideways overflow around the active view', () => {
    const source = read('./AppDashboard.tsx');
    const at = source.indexOf('<ActiveView');
    expect(at).toBeGreaterThan(-1);
    const wrapper = source.slice(source.lastIndexOf('<div', at), at);
    expect(wrapper).toContain('overflow-x-clip');
  });

  it('is needed while the deal-in starts off to the right', () => {
    const motion = read('../timeline-motion.css');
    expect(motion).toContain('translate3d(20px');
  });
});
