import { describe, expect, it, vi } from 'vitest';
import {
  createdTabRev,
  earlierStepResult,
  hasLaterStep,
  LATER_STEP_LOOK,
  laterStepPath,
  laterStepSince,
} from './app-view-step';

// Each product's docs/specs/015-api/mcp-server.md "One live view".
describe('a view keeps its own step once an agent changes the tab after it', () => {
  it('lists the tab’s newest changesets', () => {
    expect(laterStepPath('documents', 'd 1', 't/1')).toBe(
      `/documents/d%201/changesets?tab=t%2F1&limit=${LATER_STEP_LOOK}`,
    );
  });

  it('counts only an agent’s changeset past the step’s revision', () => {
    expect(hasLaterStep([], 3)).toBe(false);
    expect(hasLaterStep([{ rev: 3, agent: true }], 3)).toBe(false);
    expect(hasLaterStep([{ rev: 4, agent: true }], 3)).toBe(true);
    // A person's revert after the step is not a step of the chat's.
    expect(hasLaterStep([{ rev: 5, agent: false }], 3)).toBe(false);
    expect(
      hasLaterStep(
        [
          { rev: 5, agent: false },
          { rev: 4, agent: true },
        ],
        3,
      ),
    ).toBe(true);
  });

  it('asks only a view that sent its revision, and a failed read says no', async () => {
    const read = vi.fn(async () => ({ changesets: [{ rev: 9, agent: true }] }));
    expect(await laterStepSince(read, undefined)).toBe(false);
    expect(read).not.toHaveBeenCalled();
    expect(await laterStepSince(read, 3)).toBe(true);
    expect(await laterStepSince(read, 0)).toBe(true);
    expect(await laterStepSince(async () => ({}), 3)).toBe(false);
    expect(
      await laterStepSince(async () => {
        throw new Error('down');
      }, 3),
    ).toBe(false);
  });

  it('answers the tab’s name and links with no drawing', () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const result = earlierStepResult({
      documentId: 'd',
      tabId: 't',
      name: 'Flow',
      url: 'u',
      rev: 7,
    });
    expect(result.structuredContent).toEqual({
      documentId: 'd',
      tabId: 't',
      name: 'Flow',
      url: 'u',
      rev: 7,
      tabs: [],
      svg: '',
      viewBox: { x: 0, y: 0, width: 0, height: 0 },
      elements: [],
      superseded: true,
    });
    expect(result.content).toEqual([
      { type: 'text', text: 'Tab "Flow" has a later step: the view keeps its own.' },
    ]);
    log.mockRestore();
  });

  it('reads the revision create left its first tab at, once, and leaves it out when it cannot', async () => {
    const read = vi.fn(async () => ({ rev: 1 }));
    expect(await createdTabRev({ id: 't', rev: 2 }, read)).toEqual({ rev: 2 });
    expect(await createdTabRev({ id: 't', rev: 0 }, read)).toEqual({ rev: 0 });
    expect(read).not.toHaveBeenCalled();
    expect(await createdTabRev({ id: 't' }, read)).toEqual({ rev: 1 });
    expect(await createdTabRev(null, read)).toEqual({ rev: 1 });
    expect(read).toHaveBeenCalledTimes(2);
    expect(await createdTabRev({ id: 't' }, async () => undefined)).toEqual({});
    expect(
      await createdTabRev({ id: 't' }, async () => {
        throw new Error('down');
      }),
    ).toEqual({});
  });
});
