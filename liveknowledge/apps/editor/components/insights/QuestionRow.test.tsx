// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

  // insights.md "Likely answered elsewhere": the item named, Connect only for an Editor, busy while it connects.
  it('notes a likely item that is not connected, with Connect for an Editor', () => {
    cleanup();
    const likely = { app: 'livediagram', itemId: 'd9', title: 'Approvals Flow' } as const;
    const onConnect = vi.fn();
    const draw = (connecting: string | null, connect?: typeof onConnect) =>
      render(
        <QuestionRow
          question={{ ...QUESTION, likely }}
          canDraft={false}
          canDismiss={false}
          drafting={null}
          busy={new Set()}
          onDraft={vi.fn()}
          onDismiss={vi.fn()}
          connecting={connecting}
          onConnect={connect}
        />,
      );
    const reader = draw(null);
    expect(screen.getByText(/Likely answered in/).textContent).toBe(
      "Likely answered in Approvals Flow, which isn't connected.",
    );
    expect(screen.queryByRole('button', { name: 'Connect Approvals Flow' })).toBeNull();
    reader.unmount();
    const editor = draw(null, onConnect);
    fireEvent.click(screen.getByRole('button', { name: 'Connect Approvals Flow' }));
    expect(onConnect).toHaveBeenCalledWith(likely);
    editor.unmount();
    draw('d9', onConnect);
    expect(
      screen.getByRole('button', { name: 'Connect Approvals Flow' }).getAttribute('aria-busy'),
    ).toBe('true');
  });
});
