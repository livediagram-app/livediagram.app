import { describe, expect, it } from 'vitest';
import type { Element } from '@livediagram/document';
import { redactElementsForCommunity, redactTabDataForCommunity } from './community-redact';

// What a Community link sees of a tab and what a copy through it carries
// (docs/specs/025-community/community.md "Viewing a post's document").

const action = {
  id: 'a1',
  name: 'Ship it',
  description: 'Before Friday',
  assignee: { userId: 'user_jane', memberId: 'm1', name: 'Jane' },
  teamId: 'team-1',
  assignerId: 'guest-owner-credential',
  assignerName: 'Sam',
  status: 'open',
  createdAt: 1,
  updatedAt: 2,
};

const elements = [
  { id: 'plain', type: 'shape', x: 0 },
  {
    id: 'talked',
    type: 'shape',
    commentThread: { comments: [{ id: 'c1', text: 'secret', authorId: 'user_jane' }] },
    action,
  },
  { id: 'panel', type: 'actions', actions: [action, { ...action, id: 'a2' }] },
] as unknown as Element[];

describe('redactElementsForCommunity', () => {
  const out = redactElementsForCommunity(elements) as unknown as Record<string, unknown>[];

  it('leaves an element with nothing private untouched', () => {
    expect(out[0]).toBe(elements[0]);
  });

  it('drops comment threads', () => {
    expect(out[1]).not.toHaveProperty('commentThread');
    expect(JSON.stringify(out)).not.toContain('secret');
  });

  it('keeps an action but not the people on it', () => {
    expect(out[1]!.action).toEqual({
      ...action,
      assignee: { userId: null, name: null },
      teamId: null,
      assignerId: '',
      assignerName: null,
    });
    const json = JSON.stringify(out);
    for (const s of ['user_jane', 'Jane', 'm1', 'guest-owner-credential', 'Sam', 'team-1']) {
      expect(json).not.toContain(s);
    }
    expect((out[2]!.actions as unknown[]).length).toBe(2);
  });
});

describe('redactTabDataForCommunity', () => {
  it('redacts stored tab data, keeping its other fields', () => {
    const data = JSON.stringify({ elements, background: 'dots' });
    const parsed = JSON.parse(redactTabDataForCommunity(data));
    expect(parsed.background).toBe('dots');
    expect(JSON.stringify(parsed)).not.toContain('secret');
  });

  it('never copies data it cannot read', () => {
    expect(redactTabDataForCommunity('not json')).toBe('{"elements":[]}');
  });
});
