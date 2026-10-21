import { describe, expect, it } from 'vitest';
import type { HomeDocument } from '@livediagram/api-schema';
import { groupWhatHappened, verbOf, type WhatHappenedRow } from './what-happened';

// What happened (docs/specs/013-workspace/explorer-home.md; blueprint "Verbs", "Grouping").

const ME = new Set(['me', 'guest-me']);
const HOUR = 60 * 60 * 1000;
// 2023-11-14 22:13:20 UTC: 23:13 in Amsterdam, already the 15th in Auckland.
const AT = 1_700_000_000_000;

function doc(id: string): HomeDocument {
  return {
    documentId: id,
    name: `Doc ${id}`,
    via: 'own',
    shareCode: null,
    tabId: null,
    teamId: null,
    teamName: null,
    folderId: null,
    folderName: null,
    ownerName: 'Me',
    savedAt: AT,
    empty: false,
  };
}

function row(over: Partial<WhatHappenedRow> & Pick<WhatHappenedRow, 'eventId'>): WhatHappenedRow {
  return {
    eventType: 'document_edited',
    actorId: 'priya',
    occurredAt: AT,
    description: null,
    snapshot: {},
    document: doc('d1'),
    actor: { name: 'Priya', color: '#f00', pictureUrl: null },
    ...over,
  };
}

describe('verbOf', () => {
  it('tells a reply from a comment that starts a thread', () => {
    expect(verbOf('comment_added', { reply: true }, 'Yes', ME)).toEqual({
      verb: 'replied',
      detail: 'Yes',
    });
    expect(verbOf('comment_added', {}, 'Hi', ME)).toEqual({ verb: 'commented', detail: 'Hi' });
  });

  it('says "you" when the assignee is the reader under any identity', () => {
    expect(
      verbOf('action_assigned', { assigneeId: 'guest-me', actionName: 'Fix' }, 'x', ME),
    ).toEqual({ verb: 'assigned_you', detail: 'Fix' });
    expect(verbOf('action_assigned', { assigneeId: 'sam', actionName: 'Fix' }, 'x', ME)).toEqual({
      verb: 'assigned',
      detail: 'Fix',
    });
    expect(verbOf('action_assigned', { actionName: 'Fix' }, 'x', ME)?.verb).toBe('assigned');
  });

  it('maps the rest of the closed set', () => {
    expect(verbOf('comment_resolved', {}, 'Thread', ME)).toEqual({
      verb: 'resolved',
      detail: 'Thread',
    });
    expect(verbOf('document_edited', {}, 'Doc', ME)).toEqual({ verb: 'edited', detail: null });
    expect(verbOf('action_completed', { actionName: 'Ship' }, 'Ship', ME)).toEqual({
      verb: 'completed',
      detail: 'Ship',
    });
    expect(verbOf('team_document_added', { teamName: 'Platform' }, 'x', ME)).toEqual({
      verb: 'shared',
      detail: 'Platform',
    });
  });

  it('has no verb for anything outside the set, opens included', () => {
    expect(verbOf('document_opened', {}, 'Doc', ME)).toBeNull();
    expect(verbOf('document_opened_by_visitor', {}, 'Doc', ME)).toBeNull();
    expect(verbOf('document_renamed', {}, 'Doc', ME)).toBeNull();
  });
});

describe('groupWhatHappened', () => {
  it('groups one document per local day, newest group first', () => {
    const groups = groupWhatHappened(
      [
        row({ eventId: 'e3', occurredAt: AT, document: doc('d2') }),
        row({ eventId: 'e2', occurredAt: AT - HOUR }),
        row({ eventId: 'e1', occurredAt: AT - 30 * HOUR }),
      ],
      'UTC',
      ME,
    );
    expect(groups.map((g) => g.id)).toEqual(['d2:2023-11-14', 'd1:2023-11-14', 'd1:2023-11-13']);
    expect(groups[0]!.documentId).toBe('d2');
    expect(groups[0]!.day).toBe('2023-11-14');
  });

  it("follows the reader's zone across midnight", () => {
    const rows = [
      row({ eventId: 'late', occurredAt: AT }),
      row({ eventId: 'early', occurredAt: AT - 12 * HOUR }),
    ];
    expect(groupWhatHappened(rows, 'UTC', ME)).toHaveLength(1);
    const auckland = groupWhatHappened(rows, 'Pacific/Auckland', ME);
    expect(auckland.map((g) => g.day)).toEqual(['2023-11-15', '2023-11-14']);
  });

  it('summarises only when more than one person acted', () => {
    const one = groupWhatHappened(
      [
        row({ eventId: 'a', eventType: 'comment_added', description: 'Hi' }),
        row({ eventId: 'b', occurredAt: AT - HOUR }),
      ],
      'UTC',
      ME,
    );
    expect(one[0]!.summary).toBe(false);
    expect(one[0]!.people.map((p) => p.id)).toEqual(['priya']);

    const many = groupWhatHappened(
      [
        row({
          eventId: 'a',
          actorId: 'sam',
          actor: { name: 'Sam', color: null, pictureUrl: null },
        }),
        row({ eventId: 'b', occurredAt: AT - HOUR }),
      ],
      'UTC',
      ME,
    );
    expect(many[0]!.summary).toBe(true);
    expect(many[0]!.people).toEqual([
      { id: 'sam', name: 'Sam', color: null, pictureUrl: null },
      { id: 'priya', name: 'Priya', color: '#f00', pictureUrl: null },
    ]);
  });

  it('counts verbs in sentence order and keeps every action newest first', () => {
    const [group] = groupWhatHappened(
      [
        row({
          eventId: 'e4',
          occurredAt: AT,
          eventType: 'action_assigned',
          snapshot: { assigneeId: 'me', actionName: 'Fix' },
        }),
        row({ eventId: 'e3', occurredAt: AT - 1, eventType: 'document_edited', actorId: 'sam' }),
        row({ eventId: 'e2', occurredAt: AT - 2, eventType: 'comment_added', description: 'b' }),
        row({ eventId: 'e1', occurredAt: AT - 3, eventType: 'comment_added', description: 'a' }),
      ],
      'UTC',
      ME,
    );
    expect(group!.verbs).toEqual([
      { verb: 'commented', count: 2 },
      { verb: 'edited', count: 1 },
      { verb: 'assigned_you', count: 1 },
    ]);
    expect(group!.total).toBe(4);
    expect(group!.latestAt).toBe(AT);
    expect(group!.actions.map((a) => a.id)).toEqual(['e4', 'e3', 'e2', 'e1']);
    expect(group!.actions[0]).toEqual({
      id: 'e4',
      verb: 'assigned_you',
      personId: 'priya',
      occurredAt: AT,
      detail: 'Fix',
    });
  });

  it('drops a row it has no verb for rather than guessing', () => {
    expect(
      groupWhatHappened([row({ eventId: 'x', eventType: 'document_opened' })], 'UTC', ME),
    ).toEqual([]);
  });
});
