// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { KnowledgeQuestion } from '@liveknowledge/api-schema';
import { QuestionRow } from './QuestionRow';

const QUESTION = {
  key: 'who-approves-deploy',
  question: 'Who approves a deploy?',
  asked: 2,
  people: 2,
  agents: [],
  firstAt: 0,
  lastAt: 0,
} as unknown as KnowledgeQuestion;

const row = (drafting: string | null) =>
  render(
    <QuestionRow
      question={QUESTION}
      canDraft
      canDismiss
      drafting={drafting}
      busy={new Set()}
      onDraft={vi.fn()}
      onDismiss={vi.fn()}
    />,
  );

describe('QuestionRow', () => {
  // insights.md "Questions nobody could answer": the draft takes seconds, so its button says it is working.
  it('shows a spinner and Drafting while its page is drafted', () => {
    const { unmount } = row(QUESTION.question);
    const button = screen.getByRole('button', { name: 'Drafting…' });
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.querySelector('svg.animate-spin')).not.toBeNull();
    unmount();
    row(null);
    const idle = screen.getByRole('button', { name: 'Draft a Page' });
    expect(idle.querySelector('svg.animate-spin')).toBeNull();
  });
});
