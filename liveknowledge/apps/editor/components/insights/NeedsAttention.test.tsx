// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { forgetKnowledgeTiersForTests, setKnowledgeTier } from '@/lib/knowledge-tier';
import { NeedsAttention, conflictCostSentence, type NeedsAttentionProps } from './NeedsAttention';

// The conflict check's cost, said where its findings are (docs/specs/030-knowledgebase/tiers.md "What people see"):
// on built-in AI with Pro on only.

afterEach(() => {
  cleanup();
  forgetKnowledgeTiersForTests();
});

const noop = () => {};
const shown = (overview: Partial<NeedsAttentionProps['overview']>) =>
  render(
    <NeedsAttention
      overview={{
        conflicts: [],
        suggestions: [],
        questions: [],
        hasAi: true,
        hasKey: false,
        ...overview,
      }}
      filter="conflicts"
      onFilter={noop}
      canResolve
      canDraft
      canManageAi
      canAskOwners
      busy={new Set()}
      drafting={null}
      now={0}
      onOpenPage={noop}
      onDismissConflict={noop}
      onAskOwners={noop}
      onDraft={noop}
      onDismissQuestion={noop}
      onAccept={noop}
      onDismissSuggestion={noop}
      onOpenAiSettings={noop}
    />,
  );
const note = () => document.querySelector('[data-conflict-cost]');

describe('the conflict check’s cost', () => {
  it('says it on built-in AI with Pro on', () => {
    setKnowledgeTier('kb', { pagesMax: 100, historyDays: 30, owner: 'p:user_o' });
    shown({});
    expect(note()?.textContent).toBe('Each check after an edit uses 1 AI credit.');
    expect(conflictCostSentence()).toBe('Each check after an edit uses 1 AI credit.');
  });

  it('says nothing with Pro off, or on the team’s key', () => {
    shown({});
    expect(note()).toBeNull();
    cleanup();
    setKnowledgeTier('kb', { pagesMax: 100, historyDays: 30, owner: 'p:user_o' });
    shown({ hasKey: true });
    expect(note()).toBeNull();
  });
});
