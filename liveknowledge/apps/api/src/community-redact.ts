// What a Community post's link sees of a page, and what a copy through it carries (docs/specs/025-community/
// community.md "Viewing a post's document"): every app's rule (@liveworkspace/community/app redact.ts, its elements'
// people and conversation), and a knowledgebase's own people on top, in its pages' knowledge fields (the owner, who
// verified it, the approval's asker and decider: knowledgeForCommunity). Every Community door goes through these.
import { redactTabForCommunity } from '@liveworkspace/community/app';
import { withKnowledgeForCommunity } from '@liveknowledge/knowledge';

/** A tab (a read's, or a stored body parsed) as a Community post's reader sees it. */
export function redactPageForCommunity<T extends object>(tab: T): T {
  return withKnowledgeForCommunity(redactTabForCommunity(tab));
}

/** The same rule over a tab's stored `data` JSON, for a copy through a Community post's link: parsed once. Data that
 *  does not parse is an empty tab, and a body without elements keeps none, never copied unredacted (as the shared
 *  rule's redactTabDataForCommunity). */
export function redactPageDataForCommunity(data: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return JSON.stringify({ elements: [] });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return JSON.stringify({ elements: [] });
  const body = parsed as { elements?: unknown };
  if (!Array.isArray(body.elements))
    return JSON.stringify({ ...withKnowledgeForCommunity(body), elements: [] });
  return JSON.stringify(redactPageForCommunity(body));
}
