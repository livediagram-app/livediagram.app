// @vitest-environment jsdom

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MOTION_CASCADE_CAP_MS, cascadeDelayMs } from '@livediagram/tailwind-config/motion';
import { ExpandedStack } from './ExpandedStack';
import type { TimelineStack } from './stacking';
import type { TimelineEvent } from './types';

function event(id: string): TimelineEvent {
  return {
    id,
    sourceType: 'diagram',
    sourceId: id,
    eventType: 'diagram_renamed',
    title: 'Diagram Renamed',
    description: null,
    occurredAt: 1_700_000_000_000,
    actorId: 'me',
    snapshot: { diagramId: id, diagramName: id },
  } as TimelineEvent;
}

const stack: TimelineStack = {
  key: 'e0',
  bucket: 'diagram::diagram_renamed',
  events: Array.from({ length: 15 }, (_, i) => event(`e${i}`)),
};

const registry = {
  diagram: (e: TimelineEvent) => ({ icon: <svg />, subject: String(e.snapshot['diagramName']) }),
};

// An expansion is a cascade (docs/specs/004-interface-design/motion.md): it restarts
// from zero and, however long the run, settles within the 250ms budget.
describe('ExpandedStack', () => {
  it('staggers the run on the shared cascade, capped', () => {
    const { container } = render(
      <ExpandedStack stack={stack} registry={registry} ctx={{ viewerId: 'me' }} />,
    );
    const delays = [...container.querySelectorAll<HTMLElement>('.tl-fan-out')].map(
      (el) => el.style.animationDelay,
    );
    expect(delays).toHaveLength(15);
    expect(delays).toEqual(stack.events.map((_, i) => `${cascadeDelayMs(i)}ms`));
    expect(delays.at(-1)).toBe(`${MOTION_CASCADE_CAP_MS}ms`);
  });
});
