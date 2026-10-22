// Reads back every document a run touched, through the same MCP tools an assistant has, so a task's checks judge
// what was made rather than what the agent said it made. Read-only: it never writes.
import { resultJson, resultText } from './mcp-client.mjs';

// The outline's first line names the tab's pages: `tab 3be5 "Deck" · 53 elements: 53 boxes · 6 pages: 6 slide
// (view pages) · rev 5`.
export function parseTabHeader(line) {
  const pages = /· (\d+) pages?: ([^(]+)\(/.exec(line);
  const pageKinds = {};
  for (const m of (pages?.[2] ?? '').matchAll(/(\d+) ([\w-]+)/g)) pageKinds[m[2]] = Number(m[1]);
  return pages ? { pageCount: Number(pages[1]), pageKinds } : {};
}

async function readTab(client, documentId, tab) {
  const json = resultJson(
    await client.call('read_document', { documentId, tabId: tab.id, format: 'json' }),
  );
  const outline = resultText(await client.call('read_document', { documentId, tabId: tab.id }));
  return {
    id: tab.id,
    name: tab.name,
    ...parseTabHeader(outline?.split('\n')[0] ?? ''),
    elements: json?.tab?.elements ?? [],
    outline,
    pages: resultText(
      await client.call('read_document', { documentId, tabId: tab.id, view: 'pages' }),
    ),
  };
}

async function snapshotDocument(client, documentId) {
  const first = resultJson(await client.call('read_document', { documentId, format: 'json' }));
  if (!first) return { id: documentId, missing: true };
  const tabs = [];
  for (const tab of first.tabs ?? []) tabs.push(await readTab(client, documentId, tab));
  return { id: documentId, name: first.name, tabs };
}

export async function snapshot(client, documentIds) {
  const documents = [];
  for (const id of documentIds) documents.push(await snapshotDocument(client, id));
  return { documents };
}
