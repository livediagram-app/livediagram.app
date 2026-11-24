// A page as an agent reads it (docs/specs/024-agents/knowledgebase-for-agents.md): its writing as Markdown with
// every page link showing the linked page's current title, and how far it can be trusted. The same Markdown is what
// a suggestion's passage is found in, so an agent's read and its suggested edit agree on the text.
import {
  savedArticlesOf,
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
  verificationOn,
  type ConflictRow,
  type ReviewEvery,
} from '@liveknowledge/knowledge';
import type {
  KnowledgeConflictRef,
  KnowledgePageHealth,
  KnowledgePageTrust,
} from '@liveknowledge/api-schema';
import type { DocumentDTO, DocumentEnv } from '../types';
import { rowsOf } from './knowledge-db';

type TabSummaries = DocumentDTO['tabs'];

const titleKey = (title: string) => title.toLowerCase().replace(/\s+/g, ' ').trim();

/** A page by its id, or by its title when exactly one page has it (case and spacing aside): an agent that listed
 *  or made the pages knows them by name. Undefined for a page the knowledgebase lacks; 'ambiguous' for a title
 *  several pages share. */
export function pageNamed<T extends { id: string; name: string }>(
  tabs: readonly T[],
  ref: string,
): T | 'ambiguous' | undefined {
  const byId = tabs.find((t) => t.id === ref);
  if (byId) return byId;
  const key = titleKey(ref);
  const titled = key ? tabs.filter((t) => titleKey(t.name) === key) : [];
  return titled.length > 1 ? 'ambiguous' : titled[0];
}

/** How many page titles a refusal names before it points at the list. */
const PAGES_NAMED = 12;

/** Why a page reference names no page, in words an agent can act on. */
export function pageUnknownBody(
  tabs: readonly { id: string; name: string }[],
  ref: string,
  found: 'ambiguous' | undefined,
): { error: string; message: string } {
  const titled = tabs.filter((t) => titleKey(t.name) === titleKey(ref));
  if (found === 'ambiguous')
    return {
      error: 'page_ambiguous',
      message: `${titled.length} pages are titled "${ref}": name one by its id (${titled.map((t) => t.id).join(', ')}).`,
    };
  const some = tabs.slice(0, PAGES_NAMED).map((t) => `"${t.name}" (${t.id})`);
  const more =
    tabs.length > PAGES_NAMED
      ? `, and ${tabs.length - PAGES_NAMED} more (list_pages lists them all)`
      : '';
  return {
    error: 'page_unknown',
    message: `No page "${ref}" in this knowledgebase. Pages: ${some.join(', ')}${more}.`,
  };
}

/** The page's one article: the flow its first article page shows, else its first flow. Undefined for a page with
 *  no writing. */
export function pageFlowOf(tab: Tab): string | undefined {
  // The saved writing: a page's draft is read by nobody but the people editing it (editing.md).
  const flows = savedArticlesOf(tab);
  const shown = pagesOf(tab).find((p) => p.kind === 'article' && p.flow && flows[p.flow]);
  return shown?.flow ?? Object.keys(flows)[0];
}

/** The page's writing as Markdown, page links by their pages' current titles ("Deleted Page" for one gone). */
export function pageMarkdownOf(tab: Tab, tabs: TabSummaries): string {
  const flow = pageFlowOf(tab);
  if (!flow) return '';
  const titleOf = pageTitleIn(tabs.map((t) => ({ id: t.id, name: t.name })));
  return articleToMarkdown(withPageLinkTitles(savedArticlesOf(tab)[flow]!, titleOf));
}

type ConflictRefs = {
  byTab: Map<string, KnowledgeConflictRef[]>;
  byPassage: Map<string, KnowledgeConflictRef[]>;
};

/** The open conflicts as each page and passage names them: the other page, the question the two answer differently
 *  and when it was found (knowledgebase-for-agents.md "Conflicts for agents"), newest first as the rows come. A
 *  conflict is named only where the caller reads both of its pages: a page it cannot see (`outOfScope`, or any page
 *  but `scope` for a link confined to one page) hides it, question and all. Pure. */
export function conflictRefsOf(
  rows: readonly ConflictRow[],
  tabs: TabSummaries,
  scope: string | null = null,
): ConflictRefs {
  const titles = new Map(
    tabs
      .filter((t) => !t.outOfScope && (scope === null || t.id === scope))
      .map((t) => [t.id, t.name]),
  );
  const byTab = new Map<string, KnowledgeConflictRef[]>();
  const byPassage = new Map<string, KnowledgeConflictRef[]>();
  const note = (
    map: Map<string, KnowledgeConflictRef[]>,
    key: string,
    other: string,
    row: ConflictRow,
  ) => {
    const held = map.get(key) ?? [];
    // Two passages of the same pair asking the same question are one disagreement to an agent.
    if (!held.some((p) => p.tab === other && p.question === row.question))
      held.push({
        tab: other,
        title: titles.get(other)!,
        question: row.question,
        foundAt: row.foundAt,
      });
    map.set(key, held);
  };
  for (const row of rows) {
    if (!titles.has(row.aTab) || !titles.has(row.bTab)) continue;
    note(byTab, row.aTab, row.bTab, row);
    note(byTab, row.bTab, row.aTab, row);
    note(byPassage, row.aPassage, row.bTab, row);
    note(byPassage, row.bPassage, row.aTab, row);
  }
  return { byTab, byPassage };
}

/** The open conflicts by page and by passage, as `conflictRefsOf` names them. One read of the conflicts (at most 50),
 *  none of any page, whatever the number of pages. */
export async function openConflictPages(
  env: DocumentEnv,
  tabs: TabSummaries,
  scope: string | null = null,
): Promise<ConflictRefs> {
  return conflictRefsOf(await rowsOf<ConflictRow>(env, listConflicts()), tabs, scope);
}

/** How far a page can be trusted, from its stored fields, the knowledgebase's Review Period and the clock.
 *  `stale` is review due. */
export function pageTrustOf(
  knowledge: unknown,
  every: ReviewEvery,
  now: number,
  extra: {
    conflictsWith?: KnowledgeConflictRef[] | undefined;
    verifiedBy?: string | undefined;
    /** The page's Health Score (page-health-read.ts), where the caller scored it. */
    health?: KnowledgePageHealth | undefined;
  } = {},
): KnowledgePageTrust {
  const fields = parseKnowledgeFields(knowledge);
  // Verification off (a Review Period of Never, verification.md): the fields keep their shape, saying `off`, with no
  // date, no verifier and never stale.
  const state = verificationOn(every)
    ? trustState(fields, every, now)
    : ({ state: 'off' } as const);
  const approval = fields.approval;
  return {
    state: state.state,
    ...('verifiedAt' in state ? { verifiedAt: state.verifiedAt } : {}),
    ...(extra.verifiedBy && state.state !== 'off' ? { verifiedBy: extra.verifiedBy } : {}),
    ...('reviewAt' in state && state.reviewAt !== undefined ? { reviewAt: state.reviewAt } : {}),
    stale: state.state === 'review-due',
    ...(extra.conflictsWith?.length ? { conflictsWith: extra.conflictsWith } : {}),
    ...(approval
      ? {
          approval: {
            state: approval.state,
            requestedAt: approval.requestedAt,
            ...(approval.requestedByAgent ? { requestedByAgent: approval.requestedByAgent } : {}),
            ...(approval.decidedAt !== undefined ? { decidedAt: approval.decidedAt } : {}),
            ...(approval.note ? { note: approval.note } : {}),
          },
        }
      : {}),
    ...(extra.health ? { health: extra.health } : {}),
  };
}
