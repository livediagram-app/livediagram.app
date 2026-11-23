// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanSend } from '@liveworkspace/index-client';
import {
  addSends,
  setSendSource,
} from '@liveworkspace/workbench/components/send-to-plan/send-store';
import {
  RemoteSelectorsStrip,
  remoteSelectorCopy,
  SentCardBadge,
} from '@/components/canvas/element-badges';

// docs/specs/007-editor/editor-app.md "Concurrent-selection lock": each disc takes the pointer so its hover card can
// open, and a Viewer's disc never claims a lock.
describe('RemoteSelectorsStrip', () => {
  const jae = { id: 'p1', name: 'Jae', color: '#8b5cf6' };

  it('lets each disc take the pointer inside a pass-through strip', () => {
    const { getByLabelText } = render(
      <RemoteSelectorsStrip selectors={[{ ...jae, holds: true }]} />,
    );
    const disc = getByLabelText('Locked to Jae');
    expect(disc.closest('.pointer-events-auto')).not.toBeNull();
    expect(disc.closest('.pointer-events-none')).not.toBeNull();
  });

  it("names a Viewer's selection without claiming a lock", () => {
    const { getByLabelText, queryByLabelText } = render(
      <RemoteSelectorsStrip selectors={[{ ...jae, holds: false }]} />,
    );
    expect(getByLabelText('Selected by Jae')).toBeTruthy();
    expect(queryByLabelText('Locked to Jae')).toBeNull();
  });
});

describe('remoteSelectorCopy', () => {
  it('says the element is locked for a holder', () => {
    expect(remoteSelectorCopy({ name: 'Ava', holds: true })).toEqual({
      title: 'Locked to Ava',
      description: "Selected by them; you can't edit it right now.",
    });
  });

  it('says a Viewer is only looking', () => {
    expect(remoteSelectorCopy({ name: 'Ava', holds: false }).title).toBe('Selected by Ava');
  });
});

// docs/specs/013-workspace/send-to-plan.md "The chip": a sent sticky's disc says where its card stands, as every
// indicator does.
describe('SentCardBadge', () => {
  const sent = (id: string, card: Partial<PlanSend['card']>): PlanSend => ({
    id,
    ref: 'element:t1:s1:',
    kind: 'element',
    plan: { id: 'P', title: 'Party' },
    card: { id: `c_${id}`, title: 'Order the snacks', column: 'To Do', done: false, ...card },
    link: 'https://lp/x',
    at: 1,
  });
  afterEach(() => {
    cleanup();
    setSendSource(null);
  });

  it("names the card's column and plan, and done once it is", () => {
    setSendSource('S', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
    act(() => addSends([sent('a', {})]));
    const { getByRole } = render(<SentCardBadge elementId="s1" />);
    expect(getByRole('button').getAttribute('aria-label')).toBe(
      'Open the card “Order the snacks”, To Do · Party, in liveplanner',
    );
    setSendSource(null);
    setSendSource('S', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
    act(() => addSends([sent('b', { column: 'Done', done: true })]));
    expect(getByRole('button').getAttribute('aria-label')).toBe(
      'Open the card “Order the snacks”, done, Done · Party, in liveplanner',
    );
  });
});
