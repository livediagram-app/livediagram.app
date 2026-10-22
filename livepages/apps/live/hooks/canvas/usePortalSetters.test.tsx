// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createShape, type Tab } from '@livepages/document';
import { usePortalSetters } from './usePortalSetters';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const cover = { ...createShape('reveal', 0, 0), id: 'cover' };
const button = { ...createShape('session-button', 0, 0), id: 'button' };
const tabs = [{ id: 't1', elements: [cover, button] } as unknown as Tab];

const setters = (sessionToolsBlocked: boolean) => {
  const commitTabs = vi.fn();
  const { result } = renderHook(() =>
    usePortalSetters({
      currentSelectionIds: () => new Set(['cover', 'button']),
      contextTargetId: null,
      commitTabs,
      tabs,
      activeId: 't1',
      setSelectedId: vi.fn(),
      sessionToolsBlocked,
    }),
  );
  return { ...result.current, commitTabs };
};

// docs/specs/012-collaboration/facilitator.md "What the facilitator runs"
describe('usePortalSetters under a facilitator', () => {
  it('reveals a cover for all and configures a session button with nobody facilitating', () => {
    const s = setters(false);
    s.setRevealedSelected(true);
    s.setSessionConfigSelected({ tool: 'timer' });
    expect(s.commitTabs).toHaveBeenCalledTimes(2);
  });

  it('refuses both while somebody else holds the baton', () => {
    const s = setters(true);
    s.setRevealedSelected(true);
    s.setSessionConfigSelected({ tool: 'timer' });
    expect(s.commitTabs).not.toHaveBeenCalled();
  });
});
