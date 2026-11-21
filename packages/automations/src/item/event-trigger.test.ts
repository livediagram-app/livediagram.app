import { describe, expect, it } from 'vitest';
import { AGENT_CHANGED_EVENT, agentChangedTrigger, defineEventTrigger, itemNames } from './index';

describe('an app’s own event trigger', () => {
  const names = itemNames('document', { tabs: [{ id: 't1', name: 'Board' }], people: [] });

  it('says its own note in its format, and that nobody is behind it', () => {
    const asked = defineEventTrigger({
      kind: 'question_asked',
      name: 'Question Asked',
      group: 'Workshop',
      line: 'someone adds a note',
      note: 'its text reads as {{question}}',
      picksTab: true,
      tabbed: true,
      personless: true,
      said: (_who, tab) => `A question was asked on ${tab}`,
    });
    expect(asked.format).toBe(
      '{"kind":"question_asked","tab"?:tab} (its text reads as {{question}})',
    );
    expect(asked.personless).toBe(true);
    expect(asked.group).toBe('Workshop');
    expect(asked.read({ tab: 't1' }, 'trigger')).toEqual({
      kind: 'question_asked',
      tab: 't1',
    });
    expect(
      asked.said(
        { kind: 'question_asked' },
        { id: 'e', kind: 'question_asked', at: 1, tab: 't1' },
        names,
      ),
    ).toBe('A question was asked on Board');
  });

  it('says its line when it has no note, with somebody behind it', () => {
    const ended = defineEventTrigger({
      kind: 'poll_ended',
      name: 'Poll Ended',
      line: 'a poll ends',
      said: (who) => `${who} ended a poll`,
    });
    expect(ended.format).toBe('{"kind":"poll_ended"} (a poll ends)');
    expect(ended).not.toHaveProperty('personless');
    expect(ended.group).toBe('Changes');
  });
});

describe('Agent Made Changes', () => {
  it('is one shared kind in the app’s own words, kept to a tab when one is picked', () => {
    const names = itemNames('design', { tabs: [{ id: 't1', name: 'Logo' }], people: [] });
    const agent = agentChangedTrigger({ line: 'an agent changes it', note: 'once per write' });
    expect(agent.kind).toBe(AGENT_CHANGED_EVENT);
    expect(agent.name).toBe('Agent Made Changes');
    expect(agent.line).toBe('an agent changes it');
    expect(agent.format).toBe('{"kind":"agent_changed","tab"?:tab} (once per write)');
    expect(agent.tabbed).toBe(true);
    expect(agent.personless).toBeUndefined();
    const event = {
      id: 'e',
      kind: AGENT_CHANGED_EVENT,
      at: 1,
      tab: 't1',
      by: { id: 'a', name: 'Robot', color: '#000' },
    };
    expect(agent.matches({ kind: AGENT_CHANGED_EVENT, tab: 't1' }, event)).toBe(true);
    expect(agent.matches({ kind: AGENT_CHANGED_EVENT, tab: 't2' }, event)).toBe(false);
    expect(agent.said({ kind: AGENT_CHANGED_EVENT }, event, names)).toBe('Robot changed Logo');
  });
});
