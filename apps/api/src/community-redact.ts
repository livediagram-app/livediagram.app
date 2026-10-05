// What a Community post's link may see of a tab, and what a copy taken through it carries
// (docs/specs/025-community/community.md "Viewing a post's document"): the board's content, never its
// conversation or the people working on it. Comment threads are dropped; an assigned action keeps its
// text and status but loses who it is assigned to and who assigned it (account ids, member ids, names,
// and an assigner id that is a guest's owner credential). Pure, so the read and the copy apply the
// same rule.

import type { Element, ElementAction } from '@livediagram/document';

function anonymiseAction(action: ElementAction): ElementAction {
  return {
    ...action,
    assignee: { userId: null, name: null },
    teamId: null,
    assignerId: '',
    assignerName: null,
  };
}

export function redactElementsForCommunity(elements: Element[]): Element[] {
  return elements.map((el) => {
    const e = el as Element & {
      commentThread?: unknown;
      action?: ElementAction;
      actions?: ElementAction[];
    };
    if (!e.commentThread && !e.action && !Array.isArray(e.actions)) return el;
    const { commentThread: _thread, ...rest } = e;
    const out = { ...rest } as typeof e;
    if (e.action) out.action = anonymiseAction(e.action);
    if (Array.isArray(e.actions)) out.actions = e.actions.map(anonymiseAction);
    return out as Element;
  });
}

// The same rule over a tab's stored `data` JSON, for the copy route. Data that does not parse, or has
// no elements, is returned as an empty tab rather than copied unredacted.
export function redactTabDataForCommunity(data: string): string {
  try {
    const parsed = JSON.parse(data) as { elements?: Element[] };
    if (!Array.isArray(parsed.elements)) return JSON.stringify({ ...parsed, elements: [] });
    return JSON.stringify({ ...parsed, elements: redactElementsForCommunity(parsed.elements) });
  } catch {
    return JSON.stringify({ elements: [] });
  }
}
