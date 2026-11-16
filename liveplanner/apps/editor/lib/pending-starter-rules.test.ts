// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PENDING_STARTER_RULES_MS,
  markPendingStarterRules,
  onPendingStarterRules,
  takePendingStarterRules,
} from './pending-starter-rules';

// A template's starter rules waiting for the editor (docs/specs/026-plan/plan-templates.md "Starter rules").
afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('pending starter rules', () => {
  it('takes a kind once, and tells whoever listens that one was left', () => {
    const heard = vi.fn();
    const stop = onPendingStarterRules(heard);
    markPendingStarterRules('t1', 'sprint-board', 1000);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    markPendingStarterRules('t2', 'kanban', 1000);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(takePendingStarterRules('t1', 2000)).toBe('sprint-board');
    expect(takePendingStarterRules('t1', 2000)).toBeNull();
    expect(takePendingStarterRules('t2', 2000)).toBe('kanban');
  });

  it('leaves nothing for a template with no starter rules', () => {
    markPendingStarterRules('t1', 'budget-planner');
    expect(sessionStorage.length).toBe(0);
    expect(takePendingStarterRules('t1')).toBeNull();
  });

  it('drops a kind that waited too long', () => {
    markPendingStarterRules('t1', 'kanban', 0);
    expect(takePendingStarterRules('t1', PENDING_STARTER_RULES_MS + 1)).toBeNull();
  });

  it('reads the kind /new left across the page load, and ignores anything else under the key', () => {
    sessionStorage.setItem(
      'liveplanner:pending-starter-rules:t1',
      JSON.stringify({ kind: 'bug-triage', at: 5 }),
    );
    expect(takePendingStarterRules('t1', 10)).toBe('bug-triage');
    sessionStorage.setItem(
      'liveplanner:pending-starter-rules:t2',
      JSON.stringify({ kind: 'budget-planner', at: 5 }),
    );
    expect(takePendingStarterRules('t2', 10)).toBeNull();
    sessionStorage.setItem('liveplanner:pending-starter-rules:t3', 'not json');
    expect(takePendingStarterRules('t3', 10)).toBeNull();
    expect(takePendingStarterRules('none', 10)).toBeNull();
  });

  it('keeps the memory copy when storage is refused', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    markPendingStarterRules('t1', 'kanban', 0);
    expect(takePendingStarterRules('t1', 1)).toBe('kanban');
  });
});
