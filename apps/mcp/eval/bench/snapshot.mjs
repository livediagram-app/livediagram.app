// Reads back every document a run touched, through the same MCP tools an assistant has, so a task's checks judge
// what was made rather than what the agent said it made. Read-only: it never writes.
import { resultJson, resultText } from './mcp-client.mjs';

// The outline's first line: `tab 6cb1 "Name" · 0 elements · kind=form (read_form) · mode=plan · rev 1`.
export function parseTabHeader(line) {
  const kind = /kind=([\w-]+)/.exec(line)?.[1] ?? null;
  const mode = /mode=([\w-]+)/.exec(line)?.[1] ?? null;
  return { kind, mode };
}

async function readTab(client, documentId, tab) {
  const json = resultJson(
    await client.call('read_document', { documentId, tabId: tab.id, format: 'json' }),
  );
  const outline = resultText(await client.call('read_document', { documentId, tabId: tab.id }));
  const header = parseTabHeader(outline?.split('\n')[0] ?? '');
  const { kind } = header;
  const out = {
    id: tab.id,
    name: tab.name,
    ...header,
    elements: json?.tab?.elements ?? [],
    outline,
  };
  if (kind === 'form')
    out.form = resultJson(await client.call('read_form', { documentId, tab: tab.id }));
  return out;
}

async function snapshotDocument(client, documentId) {
  const first = resultJson(await client.call('read_document', { documentId, format: 'json' }));
  if (!first) return { id: documentId, missing: true };
  const tabs = [];
  for (const tab of first.tabs ?? []) tabs.push(await readTab(client, documentId, tab));
  const items = resultJson(await client.call('list_items', { documentId }));
  const listed = resultJson(await client.call('list_sheets', { documentId }));
  const sheets = [];
  for (const s of listed?.sheets ?? []) {
    const read = resultJson(
      await client.call('read_sheet', { documentId, sheet: s.id ?? s.title }),
    );
    sheets.push({ ...s, read });
  }
  return { id: documentId, name: first.name, tabs, items, sheets };
}

export async function snapshot(client, documentIds) {
  const documents = [];
  for (const id of documentIds) documents.push(await snapshotDocument(client, id));
  return { documents };
}
