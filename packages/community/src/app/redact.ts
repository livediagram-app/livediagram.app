// What a Community post's link may see of a tab, and what a copy taken through it carries
// (liveworkspace/docs/specs/007-community/community.md "What lives where"; each app's 025-community "Viewing a post's
// document"): the document's content, never its conversation or the people working on it. Every app's elements carry
// people the same way, so the rule is one. Pure, so the read and the copy apply the same rule:
//
// - comment threads are dropped;
// - an assigned action keeps its text and status but loses who it is assigned to and by (account ids,
//   member ids, names, and an assigner id that can be a guest's owner credential);
// - the collaboration cards keep their tallies but not their people: answers (`responses`) and Q&A
//   voters get neutral per-card ids, a Q&A note loses its author, a roll call's names become "Participant n";
// - the tab's dot vote keeps its counts per element with neutral voter ids, and loses who started it;
// - a Participant's adder key (`addedBy`, a per-document key of who added a sticky or a text) goes;
// - a picker's result drawn from the people in the room (source `participants`, the default) goes: it is a name;
// - a Notice Board's or Calendar Wall's notes (`noticeNotes`, livehuddle) keep their words, read as pinned by
//   "Someone" and lose their signer key; an Arcade Machine's High Scores (`arcadeScores`) keep their scores and
//   read as "Player n", with no signer key;
// - a component instance with its edit session open (`componentEditBy`, livedesign) names nobody: it reads
//   `someone`, still set, so the design draws as before;
// - a chart or table with live data from a plan (`chartSheetSource`, liveworkspace/docs/specs/004-index/live-data.md)
//   keeps its last values and loses the link, so a stranger is told of no other item;
// - a live embed (`liveItem`, liveworkspace/docs/specs/004-index/live-embeds.md) keeps its snapshot and loses the link,
//   for the same reason.
//
// The placeholders are per card, so a count, an average or a "3 people voted" reads the same, and
// nothing ties one card's "p1" to another's.

// An assigned action, as much of it as the rule touches.
type PeopleAction = {
  assignee: { userId: string | null; name: string | null; memberId?: string };
  teamId: string | null;
  assignerId: string;
  assignerName: string | null;
};

const neutralIds = (ids: readonly unknown[], prefix: string) =>
  ids.map((_, i) => `${prefix}${i + 1}`);

function anonymiseAction<A extends PeopleAction>(action: A): A {
  return {
    ...action,
    assignee: { userId: null, name: null },
    teamId: null,
    assignerId: '',
    assignerName: null,
  };
}

type PeopleFields = {
  commentThread?: unknown;
  cellComments?: unknown;
  action?: PeopleAction;
  actions?: PeopleAction[];
  responses?: { participantId: string }[];
  qaNotes?: { author?: unknown; voters?: string[] }[];
  rollCall?: { name: string }[];
  addedBy?: unknown;
  pickerSource?: unknown;
  pickerResult?: unknown;
  pickerDrawn?: unknown;
  noticeNotes?: { author?: unknown; by?: unknown }[];
  arcadeScores?: { name?: unknown; by?: unknown }[];
  componentEditBy?: unknown;
  chartSheetSource?: unknown;
  liveItem?: unknown;
  // A Screen's tab (livehuddle, Work Tracker 1427): goes with its link.
  liveTab?: unknown;
};

function hasPeople(e: PeopleFields): boolean {
  return Boolean(
    e.commentThread ||
    e.cellComments ||
    e.action ||
    Array.isArray(e.actions) ||
    Array.isArray(e.responses) ||
    Array.isArray(e.qaNotes) ||
    Array.isArray(e.rollCall) ||
    Array.isArray(e.noticeNotes) ||
    Array.isArray(e.arcadeScores) ||
    e.addedBy !== undefined ||
    Boolean(e.componentEditBy) ||
    ((e.pickerResult !== undefined || e.pickerDrawn !== undefined) &&
      e.pickerSource !== 'options') ||
    e.chartSheetSource !== undefined ||
    e.liveItem !== undefined ||
    e.liveTab !== undefined,
  );
}

export function redactElementsForCommunity<E extends object>(elements: E[]): E[] {
  return elements.map((el) => {
    const e = el as E & PeopleFields;
    if (!hasPeople(e)) return el;
    const {
      commentThread: _thread,
      cellComments: _cells,
      chartSheetSource: _source,
      liveItem: _live,
      liveTab: _tab,
      addedBy: _adder,
      ...rest
    } = e;
    const out = { ...rest } as E & PeopleFields;
    if (e.action) out.action = anonymiseAction(e.action);
    if (Array.isArray(e.actions)) out.actions = e.actions.map(anonymiseAction);
    if (Array.isArray(e.responses)) {
      const ids = neutralIds(e.responses, 'p');
      out.responses = e.responses.map((r, i) => ({ ...r, participantId: ids[i]! }));
    }
    if (Array.isArray(e.qaNotes)) {
      out.qaNotes = e.qaNotes.map(({ author: _author, ...note }) => ({
        ...note,
        voters: neutralIds(note.voters ?? [], 'v'),
      }));
    }
    if (Array.isArray(e.rollCall)) {
      out.rollCall = e.rollCall.map((entry, i) => ({ ...entry, name: `Participant ${i + 1}` }));
    }
    // A result from written options is the author's words; one from the room is a person's name.
    // So are the names a Remove Once Drawn round has drawn (docs/specs/012-collaboration/picker.md).
    if (e.pickerSource !== 'options') {
      delete out.pickerResult;
      delete out.pickerDrawn;
    }
    if (e.componentEditBy) out.componentEditBy = 'someone';
    if (Array.isArray(e.noticeNotes)) {
      const ids = neutralIds(e.noticeNotes, 'n');
      out.noticeNotes = e.noticeNotes.map((note, i) => ({
        ...note,
        author: 'Someone',
        by: ids[i]!,
      }));
    }
    if (Array.isArray(e.arcadeScores)) {
      const ids = neutralIds(e.arcadeScores, 's');
      out.arcadeScores = e.arcadeScores.map((score, i) => ({
        ...score,
        name: `Player ${i + 1}`,
        by: ids[i]!,
      }));
    }
    return out;
  });
}

// A Dashboard's slots (liveplanner): an Embed File's content keeps its link like an element does.
type DashboardSlots = { rows?: { slots?: { content?: { liveItem?: unknown } }[] }[] };

type TabPeople = {
  elements?: object[];
  vote?: { votes?: Record<string, string[]>; startedBy?: string };
  dashboard?: DashboardSlots;
};

// A Dashboard with every slot's Embed File link dropped, its snapshot kept (live-embeds.md "Snapshots", Work Tracker
// 1375): a stranger is told of no other item.
function redactDashboard(dashboard: DashboardSlots): DashboardSlots {
  if (!Array.isArray(dashboard.rows)) return dashboard;
  return {
    ...dashboard,
    rows: dashboard.rows.map((row) =>
      Array.isArray(row.slots)
        ? {
            ...row,
            slots: row.slots.map((slot) => {
              if (!slot.content || slot.content.liveItem === undefined) return slot;
              const { liveItem: _live, ...content } = slot.content;
              return { ...slot, content };
            }),
          }
        : row,
    ),
  };
}

// A whole tab (the read's DTO or the stored body): its elements, and its dot vote.
export function redactTabForCommunity<T extends TabPeople>(tab: T): T {
  const out: T = { ...tab };
  if (Array.isArray(tab.elements)) out.elements = redactElementsForCommunity(tab.elements);
  if (tab.dashboard && typeof tab.dashboard === 'object')
    out.dashboard = redactDashboard(tab.dashboard);
  if (tab.vote) {
    const { startedBy: _startedBy, ...vote } = tab.vote;
    const votes: Record<string, string[]> = {};
    for (const [elementId, voters] of Object.entries(tab.vote.votes ?? {})) {
      votes[elementId] = neutralIds(voters, 'v');
    }
    out.vote = { ...vote, votes };
  }
  return out;
}

// The same rule over a tab's stored `data` JSON, for the copy route. Data that does not parse, or has
// no elements, is returned as an empty tab rather than copied unredacted. The redacted elements come back
// too, so the copy can index them without parsing the data a second time.
export function redactTabDataForCommunity(data: string): { data: string; elements: object[] } {
  try {
    const parsed = JSON.parse(data) as TabPeople;
    if (!Array.isArray(parsed.elements)) {
      return { data: JSON.stringify({ ...parsed, elements: [] }), elements: [] };
    }
    const redacted = redactTabForCommunity(parsed);
    return { data: JSON.stringify(redacted), elements: redacted.elements ?? [] };
  } catch {
    return { data: JSON.stringify({ elements: [] }), elements: [] };
  }
}
