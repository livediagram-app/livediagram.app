import { describe, expect, it } from 'vitest';
import {
  redactElementsForCommunity,
  redactTabDataForCommunity,
  redactTabForCommunity,
} from './redact';

// What a Community link sees of a tab and what a copy through it carries
// (each app's 025-community "Viewing a post's document").

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
] as unknown as object[];

describe('redactElementsForCommunity', () => {
  const out = redactElementsForCommunity(elements) as unknown as Record<string, unknown>[];

  it('leaves an element with nothing private untouched', () => {
    expect(out[0]).toBe(elements[0]);
  });

  it('drops comment threads', () => {
    expect(out[1]).not.toHaveProperty('commentThread');
    expect(JSON.stringify(out)).not.toContain('secret');
  });

  it("drops a chart's sheet link and keeps its last values", () => {
    const chart = {
      id: 'chart',
      type: 'shape',
      pieSlices: [{ label: 'Q1', value: 4 }],
      chartSheetSource: { app: 'liveplanner', itemId: 'plan_secret', itemName: 'Payroll' },
    };
    const [frozen] = redactElementsForCommunity([chart]);
    expect(frozen).toEqual({ id: 'chart', type: 'shape', pieSlices: [{ label: 'Q1', value: 4 }] });
  });

  // Live data from a plan (liveworkspace/docs/specs/004-index/live-data.md "Offline and exports"): a table too.
  it("drops a table's plan link and keeps its last cells", () => {
    const table = {
      id: 'table',
      type: 'table',
      cells: [
        ['Column', 'Cards'],
        ['Done', '4'],
      ],
      chartSheetSource: { app: 'liveplanner', itemId: 'plan_secret', kind: 'board' },
    };
    const [frozen] = redactElementsForCommunity([table]);
    expect(frozen).toEqual({ id: 'table', type: 'table', cells: table.cells });
  });

  it("drops a live embed's link and keeps its snapshot", () => {
    const embed = {
      id: 'embed',
      type: 'video',
      embedProvider: 'live',
      liveItem: { app: 'liveplanner', itemId: 'plan_secret' },
      liveName: 'Roadmap',
      livePoster: 'data:image/webp;base64,AAAA',
    };
    const [frozen] = redactElementsForCommunity([embed]);
    expect(frozen).toEqual({
      id: 'embed',
      type: 'video',
      embedProvider: 'live',
      liveName: 'Roadmap',
      livePoster: 'data:image/webp;base64,AAAA',
    });
  });

  it("drops a Screen's file link and its tab, keeping its name (Work Tracker 1427)", () => {
    const screen = {
      id: 's1',
      type: 'shape',
      shape: 'screen',
      liveItem: { app: 'liveplanner', itemId: 'plan_secret' },
      liveName: 'Roadmap',
      liveTab: { id: 't2', name: 'Hiring' },
    };
    const [frozen] = redactElementsForCommunity([screen]);
    expect(frozen).toEqual({ id: 's1', type: 'shape', shape: 'screen', liveName: 'Roadmap' });
  });

  it("drops a Dashboard Embed File's link and keeps its snapshot (Work Tracker 1375)", () => {
    const embed = {
      type: 'embed',
      liveItem: { app: 'livediagram', itemId: 'canvas_secret' },
      liveName: 'Architecture',
    };
    const tab = {
      elements: [],
      dashboard: {
        rows: [{ id: 'r1', slots: [{ id: 's1', content: embed }, { id: 's2' }] }, { id: 'r2' }],
      },
    };
    const out = redactTabForCommunity(tab);
    expect(out.dashboard!.rows![0]!.slots![0]!.content).toEqual({
      type: 'embed',
      liveName: 'Architecture',
    });
    expect(out.dashboard!.rows![0]!.slots![1]).toEqual({ id: 's2' });
    expect(JSON.stringify(out)).not.toContain('canvas_secret');
    // The stored data takes the same path, and a dashboard with no rows passes as it is.
    expect(redactTabDataForCommunity(JSON.stringify(tab)).data).not.toContain('canvas_secret');
    expect(redactTabForCommunity({ dashboard: {} }).dashboard).toEqual({});
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
    const parsed: unknown = JSON.parse(redactTabDataForCommunity(data).data);
    expect(parsed).toHaveProperty('background', 'dots');
    expect(JSON.stringify(parsed)).not.toContain('secret');
  });

  it('never copies data it cannot read', () => {
    expect(redactTabDataForCommunity('not json')).toEqual({
      data: '{"elements":[]}',
      elements: [],
    });
  });
});

describe('the collaboration cards and the dot vote', () => {
  const cards = [
    {
      id: 'est',
      type: 'shape',
      responses: [
        { participantId: 'guest-credential-a', value: '5', at: 1 },
        { participantId: 'guest-credential-b', value: '8', at: 2 },
      ],
    },
    {
      id: 'qa',
      type: 'shape',
      qaNotes: [
        {
          id: 'n1',
          text: 'Why?',
          at: 1,
          author: { name: 'Priya', color: '#f00' },
          voters: ['va', 'vb'],
        },
      ],
    },
    {
      id: 'roll',
      type: 'shape',
      rollCall: [{ name: 'Aisha Khan', color: '#0f0', at: 1 }],
    },
  ] as unknown as object[];

  it('keeps the tallies and loses the people', () => {
    const tab = redactTabForCommunity({
      elements: cards,
      vote: { votes: { qa: ['voter-1', 'voter-2', 'voter-3'] }, startedBy: 'user_sam' },
    }) as unknown as {
      elements: Record<string, unknown>[];
      vote: { votes: Record<string, string[]>; startedBy?: string };
    };
    const json = JSON.stringify(tab);
    for (const s of ['guest-credential', 'Priya', 'Aisha', 'voter-1', 'user_sam', '"va"']) {
      expect(json).not.toContain(s);
    }
    expect(tab.elements[0]!.responses).toEqual([
      { participantId: 'p1', value: '5', at: 1 },
      { participantId: 'p2', value: '8', at: 2 },
    ]);
    expect((tab.elements[1]!.qaNotes as { voters: string[] }[])[0]!.voters).toHaveLength(2);
    expect(tab.elements[2]!.rollCall).toEqual([{ name: 'Participant 1', color: '#0f0', at: 1 }]);
    expect(tab.vote.votes.qa).toHaveLength(3);
    expect(tab.vote).not.toHaveProperty('startedBy');
  });
});

describe("the people each app's own pieces carry", () => {
  it("drops a Participant's adder key and a picker's name from the room, keeping written results", () => {
    const [sticky, roomPick, defaultPick, optionPick] = redactElementsForCommunity([
      { id: 's', type: 'sticky', label: 'Idea', addedBy: 'adder-key-of-jane' },
      { id: 'p1', type: 'shape', pickerSource: 'participants', pickerResult: 'Jane Doe' },
      { id: 'p2', type: 'shape', pickerResult: 'Sam Roe' },
      { id: 'p3', type: 'shape', pickerSource: 'options', pickerResult: 'Pizza' },
    ]);
    // A Remove Once Drawn round's drawn names go the same way as the result.
    const [drawnRoom, drawnList] = redactElementsForCommunity([
      { id: 'd1', type: 'shape', pickerRemoveDrawn: true, pickerDrawn: ['Jane Doe'] },
      { id: 'd2', type: 'shape', pickerSource: 'options', pickerDrawn: ['Pizza'] },
    ]);
    expect(drawnRoom).toEqual({ id: 'd1', type: 'shape', pickerRemoveDrawn: true });
    expect(drawnList).toEqual({
      id: 'd2',
      type: 'shape',
      pickerSource: 'options',
      pickerDrawn: ['Pizza'],
    });
    expect(sticky).toEqual({ id: 's', type: 'sticky', label: 'Idea' });
    expect(roomPick).toEqual({ id: 'p1', type: 'shape', pickerSource: 'participants' });
    expect(defaultPick).toEqual({ id: 'p2', type: 'shape' });
    expect(optionPick).toEqual({
      id: 'p3',
      type: 'shape',
      pickerSource: 'options',
      pickerResult: 'Pizza',
    });
  });

  it("names nobody on a component's open edit session, keeping it open so it draws as before", () => {
    const [open, closed] = redactElementsForCommunity([
      { id: 'i1', type: 'instance', componentId: 'c1', componentEditBy: 'user_jane' },
      { id: 'i2', type: 'instance', componentId: 'c1', componentEditBy: '' },
    ]);
    expect(open).toEqual({
      id: 'i1',
      type: 'instance',
      componentId: 'c1',
      componentEditBy: 'someone',
    });
    expect(closed).toEqual({ id: 'i2', type: 'instance', componentId: 'c1', componentEditBy: '' });
  });

  it("keeps a Notice Board's notes and an Arcade's scores without who wrote or played them", () => {
    const board = {
      id: 'b',
      type: 'shape',
      noticeNotes: [
        { id: 'n1', text: 'Lunch at 12', author: 'Jane Doe', by: 'user_jane', at: 5 },
        { id: 'n2', title: 'Offsite', text: 'Friday', author: 'Sam', by: 'adder-sam', at: 6 },
      ],
    };
    const arcade = {
      id: 'a',
      type: 'shape',
      arcadeScores: [
        { id: 'r1', name: 'Jane Doe', score: 900, ms: 60_000, by: 'user_jane', at: 1 },
        { id: 'r2', name: 'Sam', score: 400, ms: 30_000, by: 'adder-sam', at: 2 },
      ],
    };
    const [b, a] = redactElementsForCommunity<Record<string, unknown>>([board, arcade]);
    expect(b!.noticeNotes).toEqual([
      { id: 'n1', text: 'Lunch at 12', author: 'Someone', by: 'n1', at: 5 },
      { id: 'n2', title: 'Offsite', text: 'Friday', author: 'Someone', by: 'n2', at: 6 },
    ]);
    expect(a!.arcadeScores).toEqual([
      { id: 'r1', name: 'Player 1', score: 900, ms: 60_000, by: 's1', at: 1 },
      { id: 'r2', name: 'Player 2', score: 400, ms: 30_000, by: 's2', at: 2 },
    ]);
    // The copy's stored data takes the same rule.
    const copied = redactTabDataForCommunity(JSON.stringify({ elements: [board, arcade] })).data;
    for (const secret of ['Jane', 'Sam', 'user_jane', 'adder-sam']) {
      expect(copied).not.toContain(secret);
    }
  });
});
