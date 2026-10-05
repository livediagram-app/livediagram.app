// What a Community post's link may see of a tab, and what a copy taken through it carries
// (docs/specs/025-community/community.md "Viewing a post's document"): the document's content, never its
// conversation or the people working on it. Pure, so the read and the copy apply the same rule:
//
// - comment threads are dropped;
// - an assigned action keeps its text and status but loses who it is assigned to and by (account ids,
//   member ids, names, and an assigner id that can be a guest's owner credential);
// - the collaboration cards keep their tallies but not their people: answers (`responses`) and Q&A
//   voters get neutral per-card ids, a Q&A note loses its author, a roll call's names become "Participant n";
// - the tab's dot vote keeps its counts per element with neutral voter ids, and loses who started it.
//
// The placeholders are per card, so a count, an average or a "3 people voted" reads the same, and
// nothing ties one card's "p1" to another's.

import type { Element, ElementAction } from '@livediagram/document';

const neutralIds = (ids: readonly unknown[], prefix: string) =>
  ids.map((_, i) => `${prefix}${i + 1}`);

function anonymiseAction(action: ElementAction): ElementAction {
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
  action?: ElementAction;
  actions?: ElementAction[];
  responses?: { participantId: string }[];
  qaNotes?: { author?: unknown; voters?: string[] }[];
  rollCall?: { name: string }[];
};

function hasPeople(e: PeopleFields): boolean {
  return Boolean(
    e.commentThread ||
    e.action ||
    Array.isArray(e.actions) ||
    Array.isArray(e.responses) ||
    Array.isArray(e.qaNotes) ||
    Array.isArray(e.rollCall),
  );
}

export function redactElementsForCommunity(elements: Element[]): Element[] {
  return elements.map((el) => {
    const e = el as Element & PeopleFields;
    if (!hasPeople(e)) return el;
    const { commentThread: _thread, ...rest } = e;
    const out = { ...rest } as Element & PeopleFields;
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
    return out as Element;
  });
}

type TabPeople = {
  elements?: Element[];
  vote?: { votes?: Record<string, string[]>; startedBy?: string };
};

// A whole tab (the read's DTO or the stored body): its elements, and its dot vote.
export function redactTabForCommunity<T extends TabPeople>(tab: T): T {
  const out: T = { ...tab };
  if (Array.isArray(tab.elements)) out.elements = redactElementsForCommunity(tab.elements);
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
// no elements, is returned as an empty tab rather than copied unredacted.
export function redactTabDataForCommunity(data: string): string {
  try {
    const parsed = JSON.parse(data) as TabPeople;
    if (!Array.isArray(parsed.elements)) return JSON.stringify({ ...parsed, elements: [] });
    return JSON.stringify(redactTabForCommunity(parsed));
  } catch {
    return JSON.stringify({ elements: [] });
  }
}
