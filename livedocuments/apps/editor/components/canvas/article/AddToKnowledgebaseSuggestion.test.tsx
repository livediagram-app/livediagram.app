// @vitest-environment jsdom
// Add to Knowledgebase (docs/specs/013-workspace/suggestions.md): an Editor's article that explains a process is
// offered to the team's knowledgebase and written there as Markdown with a line back; nothing for prose or without a
// knowledgebase; never to a Participant, a Viewer or a guest.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livedocuments/document';
import { maySuggestTo } from '@liveworkspace/workbench/components/suggest/suggest-gate';
import { resetSuggestionMemoryForTests } from '@liveworkspace/workbench/components/suggest/suggest-memory';
import { resetSuggestionShowingForTests } from '@liveworkspace/workbench/components/suggest/useSuggestion';
import { SUGGEST_IDLE_MS } from '@liveworkspace/workbench/components/suggest/suggestions';

const { writeUpTarget, writeUpToKnowledgebase, articlesOf, articleTabMarkdown } = vi.hoisted(
  () => ({
    writeUpTarget: vi.fn(),
    writeUpToKnowledgebase: vi.fn().mockResolvedValue(undefined),
    articlesOf: vi.fn(),
    articleTabMarkdown: vi.fn(() => ({
      markdown: '# Release\n\n1. Tag\n',
      articles: 1,
      leftOut: 0,
    })),
  }),
);
vi.mock('@liveworkspace/workbench/components/suggest/write-up', () => ({
  writeUpTarget,
  writeUpToKnowledgebase,
  writeUpFrom: (title: string, app: string, link: string) => ` | ${title} ${app} ${link}`,
}));
vi.mock('@livedocuments/document', () => ({ articlesOf, articleTabMarkdown }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

import { AddToKnowledgebaseSuggestion } from './AddToKnowledgebaseSuggestion';

const steps = {
  a1: {
    blocks: ['Tag', 'Build', 'Ship'].map((text, i) => ({
      id: `l${i}`,
      type: 'list',
      list: 'numbered',
      runs: [{ text }],
    })),
  },
};
const kb = { id: 'kb1', title: 'Team Wiki' };
const tab = { id: 't1' } as unknown as Tab;
const session = { readOnly: false, signedIn: true };

const mount = (allowed: boolean) =>
  render(<AddToKnowledgebaseSuggestion itemId="D1" allowed={allowed} title="Release" tab={tab} />);

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
  writeUpTarget.mockResolvedValue(kb);
  articlesOf.mockReturnValue(steps);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('AddToKnowledgebaseSuggestion', () => {
  it('offers an Editor a how-to article as a page, and writes its Markdown with a line back', async () => {
    mount(maySuggestTo({ ...session, level: 'edit' }));
    await settle();
    expect(screen.getByText('Add to Knowledgebase')).toBeTruthy();
    expect(screen.getByText(/Add it to Team Wiki as a page/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Page' }));
    await act(async () => {});
    expect(writeUpToKnowledgebase).toHaveBeenCalledWith(expect.anything(), 'D1', kb, {
      title: 'Release',
      body: expect.stringMatching(
        /^# Release\n\n1\. Tag \| Release livedocuments http:\/\/localhost(:\d+)?\/document\/D1$/,
      ),
    });
  });

  it('offers nothing for prose, a tab with no article, or without a knowledgebase', async () => {
    articlesOf.mockReturnValue({});
    mount(true);
    await settle();
    articlesOf.mockReturnValue({
      a1: { blocks: [{ id: 'p', type: 'paragraph', runs: [{ text: 'Notes' }] }] },
    });
    await settle();
    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });
    expect(writeUpTarget).not.toHaveBeenCalled();
    articlesOf.mockReturnValue(steps);
    writeUpTarget.mockResolvedValue(null);
    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(writeUpTarget).toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it.each(['participate', 'view'])('is never offered to a %s, nor a guest', async (level) => {
    for (const allowed of [
      maySuggestTo({ ...session, level }),
      maySuggestTo({ ...session, level: 'edit', signedIn: false }),
    ]) {
      const view = mount(allowed);
      await settle();
      expect(screen.queryByRole('status')).toBeNull();
      view.unmount();
    }
    expect(writeUpTarget).not.toHaveBeenCalled();
  });
});
