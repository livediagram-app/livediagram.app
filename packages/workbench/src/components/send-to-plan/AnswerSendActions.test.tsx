// @vitest-environment jsdom
// An Ask AI answer's Send to Plan and Send to Knowledge Base (liveworkspace/docs/specs/020-ask/ask.md "Sending an
// answer on"): shown only while the editor's host lets this session send, which every role that can ask (Editor,
// Participant, Viewer, signed in, in the cloud) does and a guest, an embed, Offline or a Community copy does not.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/index-client', () => ({ indexClient: {} }));

import { AnswerSendActions, sendAnswerToPlan } from './AnswerSendActions';
import { setSendSource } from './send-store';
import { canSendToPlan, onSendToPlan, setSendHere, type SendRequest } from './send-to-plan-entry';
import {
  onSendWordsToKnowledge,
  type KnowledgeWords,
} from '../send-to-knowledge/send-to-knowledge-entry';

const ANSWER = 'Two things:\n\n- Book the venue\n- Send the invites';
let plans: SendRequest[] = [];
let pages: KnowledgeWords[] = [];
const offs: (() => void)[] = [];

// What SendToPlanHost does for a session canSendToPlan lets send.
function hostUp() {
  setSendSource('D', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
  setSendHere({ app: 'livediagram', tabId: 't1' });
  offs.push(onSendWordsToKnowledge((w) => pages.push(w)));
}

beforeEach(() => {
  plans = [];
  pages = [];
  offs.push(onSendToPlan((r) => plans.push(r)));
});
afterEach(() => {
  cleanup();
  for (const off of offs.splice(0)) off();
  setSendSource(null);
  setSendHere(null);
});

const row = () => render(<AnswerSendActions markdown={ANSWER} question="What next?" />);

describe('AnswerSendActions', () => {
  it.each(['Editor', 'Participant', 'Viewer'])(
    'shows both to a signed-in %s in the cloud, and sends the answer on',
    (role) => {
      // Asking and sending both read the item alone: every role's session may send the same way.
      expect(role && canSendToPlan({ signedIn: true })).toBe(true);
      hostUp();
      row();
      expect(screen.getByRole('group', { name: 'Send this answer' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Send to Plan' }));
      expect(plans).toHaveLength(1);
      expect(plans[0]!.noun).toBe('answer');
      expect(plans[0]!.places.map((p) => [p.kind, p.tabId, p.elementId, p.text])).toEqual([
        ['text', null, null, 'Book the venue'],
        ['text', null, null, 'Send the invites'],
      ]);
      fireEvent.click(screen.getByRole('button', { name: 'Send to Knowledge Base' }));
      expect(pages).toEqual([{ heading: 'What next?', markdown: ANSWER }]);
    },
  );

  it.each([
    ['a guest', { signedIn: false }],
    ['an embed', { signedIn: true, embed: true }],
    ['Offline', { signedIn: true, offline: true }],
    ['a Community copy', { signedIn: true, community: true }],
  ])('shows nothing to %s, whose host is never up', (_who, session) => {
    expect(canSendToPlan(session)).toBe(false);
    const { container } = row();
    expect(container.innerHTML).toBe('');
  });

  it('shows Send to Plan alone while no knowledgebase host listens, nothing for an empty answer', () => {
    setSendSource('D', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
    setSendHere({ app: 'livediagram', tabId: 't1' });
    row();
    expect(screen.getByRole('button', { name: 'Send to Plan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send to Knowledge Base' })).toBeNull();
    cleanup();
    const { container } = render(<AnswerSendActions markdown="  " question="?" />);
    expect(container.innerHTML).toBe('');
  });

  it('shows Send to Knowledge Base alone while only that host listens', () => {
    offs.push(onSendWordsToKnowledge((w) => pages.push(w)));
    row();
    expect(screen.queryByRole('button', { name: 'Send to Plan' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Send to Knowledge Base' })).toBeTruthy();
  });

  it('makes one card of an answer with no list, and asks nothing for no words', () => {
    hostUp();
    sendAnswerToPlan('Just **one** thing.');
    expect(plans[0]!.places.map((p) => p.text)).toEqual(['Just one thing.']);
    sendAnswerToPlan('   ');
    expect(plans).toHaveLength(1);
  });
});
