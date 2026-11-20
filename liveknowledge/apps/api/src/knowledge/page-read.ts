// A page as an agent reads it (docs/specs/024-agents/knowledgebase-for-agents.md): its writing as Markdown with
// every page link showing the linked page's current title, and how far it can be trusted. The same Markdown is what
// a suggestion's passage is found in, so an agent's read and its suggested edit agree on the text.
import {
  articlesOf,
  articleToMarkdown,
  pagesOf,
  pageTitleIn,
  withPageLinkTitles,
  type Tab,
} from '@liveknowledge/document';
import {
  listConflicts,
  parseKnowledgeFields,
  trustState,
  type ConflictRow,
} from '@liveknowledge/knowledge';
import type { KnowledgePageRef, KnowledgePageTrust } from '@liveknowledge/api-schema';
import type { DocumentDTO, DocumentEnv } from '../types';
import { rowsOf } from './knowledge-db';

type TabSummaries = DocumentDTO['tabs'];

/** The page's one article: the flow its first article page shows, else its first flow. Undefined for a page with
 *  no writing. */
export function pageFlowOf(tab: Tab): string | undefined {
  const flows = articlesOf(tab);
  const shown = pagesOf(tab).find((p) => p.kind === 'article' && p.flow && flows[p.flow]);
  return shown?.flow ?? Object.keys(flows)[0];
}

/** The page's writing as Markdown, page links by their pages' current titles ("Deleted Page" for one gone). */
export function pageMarkdownOf(tab: Tab, tabs: TabSummaries): string {
  const flow = pageFlowOf(tab);
  if (!flow) return '';
  const titleOf = pageTitleIn(tabs.map((t) => ({ id: t.id, name: t.name })));
  return articleToMarkdown(withPageLinkTitles(articlesOf(tab)[flow]!, titleOf));
}

/** For each page an open conflict names, the pages it is set against; and the same by passage. One read of the
 *  conflicts (at most 50), none of any page. */
export async function openConflictPages(
  env: DocumentEnv,
  tabs: TabSummaries,
): Promise<{ byTab: Map<string, KnowledgePageRef[]>; byPassage: Map<string, KnowledgePageRef[]> }> {
  const titles = new Map(tabs.map((t) => [t.id, t.name]));
  const byTab = new Map<string, KnowledgePageRef[]>();
  const byPassage = new Map<string, KnowledgePageRef[]>();
  const note = (map: Map<string, KnowledgePageRef[]>, key: string, other: string) => {
    const title = titles.get(other);
    if (title === undefined) return;
    const held = map.get(key) ?? [];
    if (!held.some((p) => p.tab === other)) held.push({ tab: other, title });
    map.set(key, held);
  };
  for (const row of await rowsOf<ConflictRow>(env, listConflicts())) {
    note(byTab, row.aTab, row.bTab);
    note(byTab, row.bTab, row.aTab);
    note(byPassage, row.aPassage, row.bTab);
    note(byPassage, row.bPassage, row.aTab);
  }
  return { byTab, byPassage };
}

/** How far a page can be trusted, from its stored fields and the clock. `stale` is review due. */
export function pageTrustOf(
  knowledge: unknown,
  now: number,
  extra: { conflictsWith?: KnowledgePageRef[] | undefined; verifiedBy?: string | undefined } = {},
): KnowledgePageTrust {
  const state = trustState(parseKnowledgeFields(knowledge), now);
  return {
    state: state.state,
    ...('verifiedAt' in state ? { verifiedAt: state.verifiedAt } : {}),
    ...(extra.verifiedBy ? { verifiedBy: extra.verifiedBy } : {}),
    ...('reviewAt' in state && state.reviewAt !== undefined ? { reviewAt: state.reviewAt } : {}),
    stale: state.state === 'review-due',
    ...(extra.conflictsWith?.length ? { conflictsWith: extra.conflictsWith } : {}),
  };
}
