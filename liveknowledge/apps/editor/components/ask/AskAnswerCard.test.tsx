// @vitest-environment jsdom
// docs/specs/030-knowledgebase/search-and-ask.md "What an answer shows": under a finished answer's footer, the
// platform's Send to Plan and Send to Knowledge Base (liveworkspace/docs/specs/020-ask/ask.md "Sending an answer on"),
// each while the editor's host lets this session send; only on one that has ended with its answer.
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setSendSource } from '@liveworkspace/workbench/components/send-to-plan/send-store';
import {
  onSendToPlan,
  setSendHere,
  type SendRequest,
} from '@liveworkspace/workbench/components/send-to-plan/send-to-plan-entry';
import {
  onSendWordsToKnowledge,
  type KnowledgeWords,
} from '@liveworkspace/workbench/components/send-to-knowledge/send-to-knowledge-entry';
import type { AskConversation, AskTurnView } from '@/lib/knowledge-ask/ask-conversation';
import { AskAnswerCard } from './AskAnswerCard';
import { ROLES, chromeValue, renderInEditor, type Role } from './test-chrome';

const offs: (() => void)[] = [];
afterEach(() => {
  cleanup();
  for (const off of offs.splice(0)) off();
  setSendSource(null);
  setSendHere(null);
});

const turn = (over: Partial<AskTurnView> = {}): AskTurnView => ({
  id: 't1',
  question: 'How do we release?',
  status: 'done',
  text: 'We release weekly [1].\n\n- Tag the build\n- Deploy',
  sources: [],
  notUsed: [],
  gaps: [],
  model: 'built-in',
  ...over,
});

const card = (t: AskTurnView, role: Role = 'edit') =>
  renderInEditor(
    <AskAnswerCard
      turn={t}
      conversation={{} as AskConversation}
      manageAi={false}
      canSave={false}
      onCite={vi.fn()}
      onSave={vi.fn()}
    />,
    chromeValue(role),
  );

describe('AskAnswerCard sending on', () => {
  it.each(ROLES)(
    'sends the answer on for a %s: a card an item, and the answer as written',
    (role) => {
      const plans: SendRequest[] = [];
      const pages: KnowledgeWords[] = [];
      setSendSource('K', null, { planSends: vi.fn().mockResolvedValue({ sends: [] }) });
      setSendHere({ app: 'liveknowledge', tabId: 'p1' });
      offs.push(onSendToPlan((r) => plans.push(r)));
      offs.push(onSendWordsToKnowledge((w) => pages.push(w)));
      card(turn(), role);
      fireEvent.click(screen.getByRole('button', { name: 'Send to Plan' }));
      expect(plans[0]!.places.map((p) => p.text)).toEqual(['Tag the build', 'Deploy']);
      fireEvent.click(screen.getByRole('button', { name: 'Send to Knowledge Base' }));
      expect(pages).toEqual([
        {
          heading: 'How do we release?',
          markdown: 'We release weekly.\n\n- Tag the build\n- Deploy',
        },
      ]);
    },
  );

  it('offers neither while no host lets this session send, nor on an answer stopped part way', () => {
    card(turn());
    expect(screen.queryByRole('group', { name: 'Send this answer' })).toBeNull();
    cleanup();
    offs.push(onSendWordsToKnowledge(() => {}));
    card(turn({ status: 'stopped', text: 'Partial' }));
    expect(screen.queryByRole('group', { name: 'Send this answer' })).toBeNull();
  });
});
