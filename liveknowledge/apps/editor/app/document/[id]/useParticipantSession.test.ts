// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tab } from '@liveknowledge/document';
import { useParticipantSession } from './useParticipantSession';

// docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles": a Participant is an Editor minus the
// Review Period, the Knowledgebase Style and automations, so no commit of its is held back.
const box = { x: 0, y: 0, width: 10, height: 10 };
const tab = (elements: unknown[]): Tab => ({ id: 't', name: 'T', elements }) as Tab;
const note = { id: 'a', type: 'sticky', ...box, label: 'Hi' };

describe('useParticipantSession', () => {
  it.each(['edit', 'participate'] as const)(
    'lets a %s session commit anything, untouched',
    (level) => {
      const { result } = renderHook(() => useParticipantSession(level));
      expect(result.current.participating).toBe(false);
      for (const after of [tab([]), tab([note, { ...note, id: 'n' }]), tab([{ ...note, x: 50 }])])
        expect(result.current.guardCommit(tab([note]), after)).toBe(after);
    },
  );

  it('answers the level its rights are for, and only an Editor manages the knowledgebase', () => {
    const editor = renderHook(() => useParticipantSession('edit')).result.current.can;
    const participant = renderHook(() => useParticipantSession('participate')).result.current.can;
    expect([editor.level, editor.manageKnowledgebase]).toEqual(['edit', true]);
    expect([participant.level, participant.manageKnowledgebase]).toEqual(['participate', false]);
    expect(participant.editPages && participant.writeArticle).toBe(true);
  });
});
