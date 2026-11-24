// @vitest-environment jsdom
// Write It Up (docs/specs/013-workspace/suggestions.md): an Editor's card moved to done with a decision offers a page
// in the team's knowledgebase, written in one click; nothing without a knowledgebase; never to a Participant, a
// Viewer or a guest.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@liveplanner/items';
import { maySuggestTo } from '@liveworkspace/workbench/components/suggest/suggest-gate';
import { resetSuggestionMemoryForTests } from '@liveworkspace/workbench/components/suggest/suggest-memory';
import { resetSuggestionShowingForTests } from '@liveworkspace/workbench/components/suggest/useSuggestion';
import { SUGGEST_IDLE_MS } from '@liveworkspace/workbench/components/suggest/suggestions';
import { noteStatusWrite, resetWriteUpWatchForTests } from '@/lib/write-up-trigger';

const { writeUpTarget, writeUpToKnowledgebase } = vi.hoisted(() => ({
  writeUpTarget: vi.fn(),
  writeUpToKnowledgebase: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@liveworkspace/workbench/components/suggest/write-up', () => ({
  writeUpTarget,
  writeUpToKnowledgebase,
  writeUpFrom: (title: string, app: string, link: string) => ` | ${title} ${app} ${link}`,
}));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

import { WriteUpSuggestion } from './WriteUpSuggestion';

const kb = { id: 'kb1', title: 'Team Wiki' };
const phases = new Map([
  ['todo', 'todo'],
  ['done', 'done'],
]);
const items = new Map<string, Item>([
  [
    'c1',
    {
      id: 'c1',
      type: 'task',
      fields: { title: 'Pick a database', status: 'done', description: 'We decided on Postgres.' },
    } as unknown as Item,
  ],
]);

const session = { readOnly: false, signedIn: true };

function mount(allowed: boolean) {
  return render(
    <WriteUpSuggestion
      itemId="P1"
      allowed={allowed}
      planTitle="Launch"
      items={items}
      statusPhases={phases}
      tabId="t1"
    />,
  );
}

async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(SUGGEST_IDLE_MS);
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  resetSuggestionMemoryForTests();
  resetSuggestionShowingForTests();
  resetWriteUpWatchForTests();
  writeUpTarget.mockResolvedValue(kb);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('WriteUpSuggestion', () => {
  it('offers an Editor a done decision as a page, and writes it with a line back', async () => {
    mount(maySuggestTo({ ...session, level: 'edit' }));
    act(() => noteStatusWrite({ kind: 'move', id: 'c1', move: { status: 'done' } }));
    await settle();
    expect(screen.getByText('Write It Up')).toBeTruthy();
    expect(
      screen.getByText(/“Pick a database” is done, with a decision in it\. .*Team Wiki/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Write Page' }));
    await act(async () => {});
    expect(writeUpToKnowledgebase).toHaveBeenCalledWith(expect.anything(), 'P1', kb, {
      title: 'Pick a database',
      body: expect.stringMatching(
        /^We decided on Postgres\. \| Launch liveplanner http:\/\/localhost(:\d+)?\/project\/P1#/,
      ),
    });
  });

  it('offers nothing without a knowledgebase to write in, or with no card done', async () => {
    mount(true);
    await settle();
    expect(writeUpTarget).not.toHaveBeenCalled();
    writeUpTarget.mockResolvedValue(null);
    act(() => noteStatusWrite({ kind: 'move', id: 'c1', move: { status: 'done' } }));
    await settle();
    expect(writeUpTarget).toHaveBeenCalledWith('P1');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each(['participate', 'view'])('is never offered to a %s, nor a guest', async (level) => {
    for (const allowed of [
      maySuggestTo({ ...session, level }),
      maySuggestTo({ ...session, level: 'edit', signedIn: false }),
    ]) {
      const view = mount(allowed);
      act(() => noteStatusWrite({ kind: 'move', id: 'c1', move: { status: 'done' } }));
      await settle();
      expect(screen.queryByRole('status')).toBeNull();
      view.unmount();
    }
  });
});
