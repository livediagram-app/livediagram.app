// A page made from an answer or for a gap (docs/specs/030-knowledgebase/search-and-ask.md "It does not guess",
// insights.md "Questions nobody could answer"): its Markdown read the way an imported page's is
// (`importedPageTab`: text only, the reader keeps http, https and mailto links and nothing that runs), added through
// the editor's own page list so the autosave stores it like any page a person adds. Editor only: the caller gates
// on `makePages`, and the tree and the room check again.
import { openPagesMax } from '@/lib/knowledge-tier';
import { pageAddRefusal, truncateName, withPageAdded, type Tab } from '@liveknowledge/document';
import { PAGE_LINK_SCHEME, type PlannedPage } from '@liveknowledge/knowledge-import';
import type { AskSource } from '@liveknowledge/api-schema';
import type { EditorContextValue } from '@/app/document/[id]/EditorContext';
import { pageTreeRefusalText } from '@/hooks/persistence/page-tree-edits';
import { markArticleSettle } from '@/lib/article/article-grow-store';
import { importedPageTab } from '@/lib/knowledge-import/page-content';
import { newTabSeed } from '@/lib/new-tab-seed';
import { answerMarkdown, answerWithoutMarkers } from './answer-parts';

/** The first line of a page drafted for a gap. */
export const DRAFT_MARK = 'Draft, Not Verified';

export type MadePage = { ok: true; id: string; title: string } | { ok: false; reason: string };

type PageEditor = Pick<EditorContextValue, 'tabs' | 'activeTab' | 'commitTabs' | 'markTabLoaded'>;

/** A page's title from a question: one line, the question mark kept, a closing full stop dropped (a Knowledge Gap
 *  is a sentence; a title has none), capped as every name is. */
export function titleFromQuestion(question: string): string {
  const line = question
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(?<!\.)\.$/, '');
  return truncateName(line) || 'Untitled Page';
}

/** Add a page titled `title` holding `markdown`, under `parent` (the top level when absent). `links` are the pages
 *  its `knowledgebase-page:<key>` links point at. */
export function makePage(
  editor: PageEditor,
  input: {
    title: string;
    markdown: string;
    parent?: string;
    links?: ReadonlyMap<string, string>;
    offline?: boolean;
  },
  newId: () => string = () => crypto.randomUUID(),
): MadePage {
  const refused = pageAddRefusal(editor.tabs, input.parent, openPagesMax());
  if (refused) return { ok: false, reason: pageTreeRefusalText(refused) };
  const page: PlannedPage = {
    key: 'p0',
    title: input.title,
    parentKey: null,
    markdown: input.markdown,
    links: [],
    pictures: [],
    attachments: [],
    warnings: [],
  };
  const built = importedPageTab({
    page,
    id: newId(),
    ...(input.parent ? { parent: input.parent } : {}),
    pageIdOf: (key) => input.links?.get(key),
    pictures: [],
    seed: newTabSeed(editor.activeTab),
    ...(input.offline ? { offline: true } : {}),
  });
  if (!built.ok) return { ok: false, reason: `The page could not be made. ${built.reason}` };
  const { tab, flow } = built;
  editor.markTabLoaded(tab.id);
  // This editor is the writer of what came in: it lays the writing out when the page is opened.
  markArticleSettle(tab.id, flow);
  editor.commitTabs((tabs: Tab[]) => {
    const next = withPageAdded(tabs, tab, input.parent);
    return Array.isArray(next) ? next : tabs;
  });
  return { ok: true, id: tab.id, title: tab.name };
}

// The Markdown of an answer with each cited page a link to it (a page that has gone reads as its title).
function answerBody(
  text: string,
  sources: readonly Pick<AskSource, 'number' | 'title' | 'tab'>[],
  has: (tab: string) => boolean,
): { markdown: string; links: Map<string, string> } {
  const links = new Map<string, string>();
  const bySource = new Map(sources.map((source) => [source.number, source.tab]));
  const markdown = answerMarkdown(answerWithoutMarkers(text), sources, (source) => {
    const tab = bySource.get(source.number);
    if (!tab || !has(tab)) return undefined;
    const key = `p${source.number}`;
    links.set(key, tab);
    return `${PAGE_LINK_SCHEME}${key}`;
  });
  return { markdown, links };
}

/** Save as Page: the answer as a subpage of `parent`, titled from its question, its sources linked. */
export function saveAnswerAsPage(
  editor: PageEditor,
  input: {
    question: string;
    text: string;
    sources: readonly AskSource[];
    parent: string;
    offline?: boolean;
  },
): MadePage {
  const has = (tab: string) => editor.tabs.some((t) => t.id === tab);
  const { markdown, links } = answerBody(input.text, input.sources, has);
  return makePage(editor, {
    title: titleFromQuestion(input.question),
    markdown,
    parent: input.parent,
    links,
    ...(input.offline ? { offline: true } : {}),
  });
}

/** Draft a Page: titled from the question, its first line "Draft, Not Verified". With a draft (an answer made from
 *  the nearest passages) the draft follows; without one the page holds the question as its first heading. */
export function draftPageForQuestion(
  editor: PageEditor,
  input: {
    question: string;
    draft?: { text: string; sources: readonly AskSource[] } | undefined;
    parent?: string;
    offline?: boolean;
  },
): MadePage {
  const question = input.question.trim().replace(/\s+/g, ' ');
  const has = (tab: string) => editor.tabs.some((t) => t.id === tab);
  const body = input.draft?.text.trim()
    ? answerBody(input.draft.text, input.draft.sources, has)
    : { markdown: '', links: new Map<string, string>() };
  // The question is other people's text: as a heading it is one line with nothing Markdown would read as a mark.
  const heading = question.replace(/([\\`*_[\]<>#])/g, '\\$1');
  const markdown = [`*${DRAFT_MARK}*`, `## ${heading}`, body.markdown].filter(Boolean).join('\n\n');
  return makePage(editor, {
    title: titleFromQuestion(question),
    markdown,
    ...(input.parent ? { parent: input.parent } : {}),
    links: body.links,
    ...(input.offline ? { offline: true } : {}),
  });
}
