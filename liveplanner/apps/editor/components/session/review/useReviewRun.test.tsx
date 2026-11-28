// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Item, ItemTypeDef } from '@liveplanner/items';
import { newSessionTab, type SessionTabState } from '@liveplanner/project';
import type { PlanContextValue } from '@/components/plan/PlanContext';
import { liveThreads, PLAN } from '@/components/plan/threads/thread-test-kit';
import { useReviewRun } from './useReviewRun';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/026-plan/session-tabs.md "Sprint Review": the guards on the review's writes, and the shapes a follow-up's
// link takes by its type.
const PERSON = { id: 'p', name: 'P', color: '#000' };
const story: ItemTypeDef = {
  id: 'story',
  label: 'Story',
  newTitle: 'New story',
  glyph: 'task',
  color: '#0ea5e9',
  prefix: 'ST',
  fields: ['title', 'status', 'f-follow'],
  statuses: ['todo', 'done'],
  custom: [{ id: 'f-follow', label: 'Follow-up Of', kind: 'card', linkType: 'story' }],
};
const bare: ItemTypeDef = {
  id: 'bare',
  label: 'Bare',
  newTitle: 'New bare',
  glyph: 'task',
  color: '#64748b',
  fields: ['title', 'status'],
  statuses: ['todo'],
};
const from: Item = {
  id: 'a',
  type: 'story',
  key: 1,
  rank: 'a',
  fields: { title: 'Done thing', status: 'done' },
  rev: 1,
  createdAt: 0,
  updatedAt: 0,
  createdBy: PERSON,
  updatedBy: PERSON,
};

function setup(opts: { runs: boolean; canComment?: boolean; threads?: boolean }) {
  const plan = {
    items: new Map([['a', from]]),
    types: [story, bare],
    statusNames: new Map([
      ['todo', 'To Do'],
      ['done', 'Done'],
    ]),
    addItem: vi.fn(async () => true),
    announce: vi.fn(),
  } as unknown as PlanContextValue;
  const run = vi.fn();
  const session: SessionTabState = newSessionTab('review', {
    typeIds: ['story'],
    statuses: ['done'],
  });
  const live = liveThreads([], { canComment: opts.canComment ?? true, projectId: PLAN });
  const wrapper =
    opts.threads === false
      ? undefined
      : ({ children }: { children: ReactNode }) => <live.Live>{children}</live.Live>;
  const hook = renderHook(() => useReviewRun({ tabId: 't', session, plan, runs: opts.runs, run }), {
    ...(wrapper ? { wrapper } : {}),
  });
  return { hook, plan, run, acts: live.acts };
}

describe('useReviewRun', () => {
  it('writes nothing for someone not running it, or with nothing to say', async () => {
    const { hook, plan, run, acts } = setup({ runs: false });
    hook.result.current.setPresenter('a', null);
    expect(run).not.toHaveBeenCalled();
    expect(await hook.result.current.followUp({ from, title: 'X', typeId: 'story' })).toBeNull();
    expect(plan.addItem).not.toHaveBeenCalled();
    let kept = true;
    await act(async () => {
      kept = await hook.result.current.addFeedback('a', '   ');
    });
    expect(kept).toBe(false);
    expect(acts).toEqual([]);
  });

  it('with no threads or no comment rights, takes no feedback and counts none', async () => {
    const { hook } = setup({ runs: true, threads: false });
    expect(hook.result.current.canFeedback).toBe(false);
    expect(hook.result.current.feedbackOn('a')).toBe(0);
    expect(hook.result.current.latestFeedback('a')).toBe('');
    expect(await hook.result.current.addFeedback('a', 'Hi')).toBe(false);
    const viewer = setup({ runs: true, canComment: false });
    expect(await viewer.hook.result.current.addFeedback('a', 'Hi')).toBe(false);
    expect(viewer.acts).toEqual([]);
  });

  it('links through a single Card field, or not at all on a bare type; a blank title makes nothing', async () => {
    const { hook, plan, run } = setup({ runs: true });
    expect(await hook.result.current.followUp({ from, title: '  ', typeId: 'story' })).toBeNull();
    await hook.result.current.followUp({ from, title: 'Next', typeId: 'story' });
    expect(plan.addItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ fields: { title: 'Next', 'f-follow': 'a' }, status: 'todo' }),
    );
    await hook.result.current.followUp({ from, title: 'Plain', typeId: 'bare' });
    expect(plan.addItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'bare', fields: { title: 'Plain' } }),
    );
    expect(run).toHaveBeenCalledTimes(2);
  });
});
