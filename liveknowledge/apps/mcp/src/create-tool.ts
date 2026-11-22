// create_document (docs/specs/015-api/mcp-server.md §4.3; docs/specs/024-agents/knowledgebase-for-agents.md): a new
// knowledgebase with the pages it starts with, each built from Markdown as create_page builds one
// (@liveknowledge/edit-operations `newPageFromMarkdown`), or with a first page from a template. One request makes
// the knowledgebase and its pages together.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CREATION_INTENT, type LiveDoc } from '@liveknowledge/api-schema';
import { mcpCreateDocument } from '@liveknowledge/agent-verbs/mcp';
import type { Tab } from '@liveknowledge/document';
import { newPageFromMarkdown } from '@liveknowledge/edit-operations';
import {
  buildTemplateTabs,
  closestTemplatesHint,
  resolveTemplate,
  templateTabName,
  validTemplateKinds,
} from '@liveknowledge/templates';
import { createdFolderLabel } from '@liveworkspace/mcp-kit/created-folder';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { apiJson, clientFor } from './api';
import { registerTool } from './tool-annotations';
import { deepLink, errorResult, requireToken, textResult } from './tool-helpers';

type GivenPage = { title: string; markdown?: string | undefined; parent?: string | undefined };

const titleKey = (title: string) => title.toLowerCase().replace(/\s+/g, ' ').trim();

/** The pages as tabs, in the order given: `parent` names an earlier page of the call by its title, and `[[Title]]`
 *  links to any page of the call. An error names the page and what to send instead. */
export function pagesAsTabs(
  pages: readonly GivenPage[],
  newId: () => string = () => crypto.randomUUID(),
): { tabs: Tab[] } | { error: string } {
  const ids = pages.map(() => newId());
  const byTitle = new Map<string, string>();
  pages.forEach((page, i) => {
    if (!byTitle.has(titleKey(page.title))) byTitle.set(titleKey(page.title), ids[i]!);
  });
  const earlier = new Map<string, string>();
  const tabs: Tab[] = [];
  for (const [i, page] of pages.entries()) {
    const parent = page.parent === undefined ? undefined : earlier.get(titleKey(page.parent));
    if (page.parent !== undefined && !parent)
      return {
        error:
          `Page "${page.title}": no earlier page of this call is titled "${page.parent}". ` +
          'Put a parent before the pages under it, and name it by its exact title.',
      };
    const made = newPageFromMarkdown(
      {
        id: ids[i]!,
        title: page.title,
        ...(page.markdown === undefined ? {} : { markdown: page.markdown }),
        ...(parent ? { parent } : {}),
      },
      { pageByTitle: (title) => byTitle.get(titleKey(title)) },
    );
    if ('refusal' in made) return { error: `Page "${page.title}": ${made.refusal.message}` };
    tabs.push(made.tab);
    if (!earlier.has(titleKey(page.title))) earlier.set(titleKey(page.title), ids[i]!);
  }
  return { tabs };
}

export function registerCreateTool(server: McpServer, env: Env): void {
  registerTool(server, env, mcpCreateDocument, async (args, extra) => {
    const token = requireToken(extra);
    if (args.pages && args.template)
      return errorResult(
        'Send "pages" or "template", not both: a template makes the first page, and create_page adds the rest.',
      );
    let tabs: Tab[];
    if (args.template) {
      const kind = resolveTemplate(args.template);
      if (!kind)
        return errorResult(
          `Unknown template "${args.template}". ${closestTemplatesHint(args.template)}` +
            `Valid kinds: ${validTemplateKinds()}.`,
        );
      tabs = buildTemplateTabs(
        { id: crypto.randomUUID(), name: templateTabName(undefined, kind) },
        kind,
        () => crypto.randomUUID(),
        undefined,
      );
    } else {
      // With no pages named, one empty page titled as the knowledgebase is.
      const built = pagesAsTabs(args.pages ?? [{ title: args.name }]);
      if ('error' in built) return errorResult(built.error);
      tabs = built.tabs;
    }
    const id = crypto.randomUUID();
    // Tagged as made by AI (docs/specs/013-workspace/folders.md) and filed by its creation intent
    // (docs/specs/013-workspace/default-folders.md): with no folder named, the user's default folder for it.
    const { document: created } = await apiJson<{ document?: LiveDoc }>(env, token, '/documents', {
      method: 'POST',
      // markUsed only when the model gave one: absent, the making counts (the api's default).
      body: JSON.stringify({
        id,
        name: args.name,
        tabs,
        source: 'mcp',
        intent: CREATION_INTENT,
        ...(args.markUsed !== undefined ? { markUsed: args.markUsed } : {}),
      }),
    });
    return textResult({
      id,
      documentId: id,
      name: created?.name ?? args.name,
      pages: tabs.map((t) => ({
        page: t.id,
        title: t.name,
        ...(t.parent ? { parent: t.parent } : {}),
      })),
      folder: await createdFolderLabel(clientFor(env, token), created, 'create_document'),
      url: deepLink(env, id),
      next: 'create_page adds a page to it; no page is verified until a person verifies it. share_document makes a link for teammates.',
    });
  });
}
