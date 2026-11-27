// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AN_AGENT, agentForPerson } from './agent-for-person';
import { AiWriterMark } from './AiWriterMark';
import { AiChip, AiCommentMarks } from './AiCommentMarks';

// liveworkspace's inbox-reading.md "AI comments": the marks beside an assistant's name, in the Inbox and every thread.
describe('an assistant’s comment marks', () => {
  it('show the AI chip, whom it wrote for and, only when flagged, its ask', () => {
    const { container, rerender } = render(<AiCommentMarks forName="Priya Shah" needsResponse />);
    expect(container.querySelector('[data-ai-chip]')!.textContent).toBe('AI');
    expect(container.textContent).toContain('for Priya Shah');
    expect(container.querySelector('[data-ai-asks]')!.textContent).toBe('Asks for a response');
    rerender(<AiCommentMarks />);
    expect(container.textContent).toBe('AI');
    expect(container.querySelector('[data-ai-asks]')).toBeNull();
  });

  it('say "for you" on the Inbox chip and carry the data they are given', () => {
    const { container } = render(<AiChip forYou data-inbox-ai="" />);
    const chip = container.querySelector('[data-inbox-ai]')!;
    expect(chip.textContent).toBe('AIfor you');
    expect(chip.hasAttribute('title')).toBe(false);
  });
});

// liveknowledge's verification.md "Made by a person or an agent", liveplanner's items.md "History".
describe('agentForPerson', () => {
  it('names the agent and the person it wrote for', () => {
    expect(agentForPerson('Claude', 'Priya Shah')).toBe('Claude for Priya Shah');
    expect(agentForPerson('  Claude ', ' Priya Shah ')).toBe('Claude for Priya Shah');
  });

  it('names the agent alone with no person, and a nameless agent by the fallback', () => {
    expect(agentForPerson('Claude', undefined)).toBe('Claude');
    expect(agentForPerson('Claude', '  ')).toBe('Claude');
    expect(agentForPerson(null, 'Priya Shah')).toBe(`${AN_AGENT} for Priya Shah`);
    expect(agentForPerson('', 'Priya Shah', 'an agent')).toBe('an agent for Priya Shah');
    expect(agentForPerson(undefined, null)).toBe(AN_AGENT);
  });
});

describe('the AI sparkle', () => {
  it('is an image named by its words, its glyph hidden, carrying the data it is given', () => {
    const { container } = render(<AiWriterMark words="Edited by AI" data-activity-ai="" />);
    const mark = screen.getByRole('img', { name: 'Edited by AI' });
    expect(mark.dataset.aiWriter).toBe('');
    expect(mark.dataset.activityAi).toBe('');
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
