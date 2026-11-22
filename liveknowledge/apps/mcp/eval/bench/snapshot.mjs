// Reads back every knowledgebase a run touched, through the same MCP tools an assistant has, so a task's checks
// judge what was made rather than what the agent said it made. Read-only: it never writes. Each page is read
// whole (its reads are counted as any agent's are, under this client's name).
import { resultJson } from '@liveworkspace/mcp-kit/eval/mcp-client';

// The longest a page is read: a page's Markdown is never longer (ARTICLE_MARKDOWN_MAX).
const WHOLE_PAGE = 400_000;

async function snapshotDocument(client, documentId) {
  const listed = resultJson(await client.call('list_pages', { documentId, limit: 500 }));
  if (!listed?.pages) return { id: documentId, missing: true };
  const context = resultJson(await client.call('get_context', { documentId }));
  const pages = [];
  for (const row of listed.pages) {
    const read = resultJson(
      await client.call('read_page', { documentId, page: row.page, max_chars: WHOLE_PAGE }),
    );
    pages.push({
      page: row.page,
      title: row.title,
      depth: row.depth,
      ...(row.parent ? { parent: row.parent } : {}),
      verified: row.verified,
      markdown: read?.markdown ?? '',
    });
  }
  return { id: documentId, name: context?.knowledgebase, pages };
}

export async function snapshot(client, documentIds) {
  const documents = [];
  for (const id of documentIds) documents.push(await snapshotDocument(client, id));
  return { documents };
}
