// @vitest-environment jsdom

// The Sequence tour (docs/specs/007-editor/element-tours.md "The Sequence tour"): the diagram on the canvas, then its
// Sequence dialog, opened by the tour, step by step.

import { describe, expect, it, vi } from 'vitest';
import type { ElementTourApi } from './element-tour-api';
import { sequenceTourSteps, type SequenceTourContext } from './sequence-tour-steps';

vi.mock('./tour-dom', () => ({ waitForSelector: async () => null }));

const ctxOf = (over: Partial<SequenceTourContext> = {}): SequenceTourContext => ({
  elementId: 'sq',
  hasMore: true,
  touch: false,
  hasMessages: true,
  ...over,
});
const api = () =>
  ({
    openSequence: vi.fn(),
    closeSequence: vi.fn(),
    showSequenceTab: vi.fn(),
  }) as unknown as ElementTourApi;

describe('sequenceTourSteps', () => {
  it('reads the diagram, its menu, then walks the Sequence dialog', () => {
    expect(sequenceTourSteps(ctxOf()).map((s) => s.id)).toEqual([
      'diagram',
      'menu',
      'write',
      'participants',
      'messages',
      'kind',
      'add',
      'text',
      'preview',
      'numbered',
      'outro',
    ]);
  });

  it('leaves out the kind with no messages, and the menu where More is not shown', () => {
    const ids = sequenceTourSteps(ctxOf({ hasMessages: false, hasMore: false })).map((s) => s.id);
    expect(ids).not.toContain('kind');
    expect(ids).not.toContain('menu');
  });

  it('puts the dialog away on a canvas step, and opens it on the tab each dialog step is about', async () => {
    const steps = sequenceTourSteps(ctxOf());
    const a = api();
    await steps.find((s) => s.id === 'write')!.prepare!(a);
    expect(a.closeSequence).toHaveBeenCalled();
    const kind = steps.find((s) => s.id === 'kind')!;
    expect(kind.layer).toBe('modal');
    expect(kind.target).toBe('sequence-kind');
    await kind.prepare!(a);
    expect(a.openSequence).toHaveBeenCalled();
    expect(a.showSequenceTab).toHaveBeenLastCalledWith('messages');
    const text = steps.find((s) => s.id === 'text')!;
    await text.prepare!(a);
    expect(a.showSequenceTab).toHaveBeenLastCalledWith('text');
    text.cleanup!(a);
    expect(a.showSequenceTab).toHaveBeenLastCalledWith('messages');
  });

  it('names Enter and Backspace on a keyboard only', () => {
    const body = (touch: boolean) =>
      sequenceTourSteps(ctxOf({ touch })).find((s) => s.id === 'messages')!.body;
    expect(body(false)).toContain('Enter in the words');
    expect(body(true)).not.toContain('Enter');
    expect(sequenceTourSteps(ctxOf({ touch: true })).find((s) => s.id === 'write')!.body).toMatch(
      /^Double-tap/,
    );
  });

  it('ends on its card', () => {
    expect(sequenceTourSteps(ctxOf()).at(-1)).toMatchObject({
      card: 'outro',
      title: 'That Is a Sequence Diagram',
    });
  });
});
