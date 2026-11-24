// @vitest-environment jsdom

// The Cited by Ask bar (liveworkspace/docs/specs/004-index/knowledge-sources.md "The Cited by Ask bar"): shown only
// for an address an answer made, with the question and the way back, and gone once closed.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { knowledgePlaceHash } from '@liveworkspace/index-client';
import { AskCitationBar, answerHref } from './AskCitationBar';

afterEach(cleanup);

describe('AskCitationBar', () => {
  it('shows the question with Back to the Answer, and closes', () => {
    const hash = knowledgePlaceHash(
      { tabId: 't1', elementIds: ['e1'] },
      { question: 'How does checkout pay?', from: 'kb_1' },
    );
    render(<AskCitationBar hash={hash} />);
    const bar = screen.getByRole('region', { name: 'Cited by Ask' });
    expect(bar.textContent).toContain('Cited by Ask: How does checkout pay?');
    const back = screen.getByRole('link', { name: 'Back to the Answer' });
    expect(back.getAttribute('href')).toMatch(/\/document\/kb_1\?view=ask$/);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'Cited by Ask' })).toBeNull();
  });

  it('shows nothing for an ordinary deep link', () => {
    render(<AskCitationBar hash="#t=t1&el=e1" />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it("goes back to the knowledgebase's Ask view", () => {
    expect(answerHref('kb 1', 'https://kb.test')).toBe('https://kb.test/document/kb%201?view=ask');
  });
});
