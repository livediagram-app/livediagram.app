// Reads back every design a run touched, through the same MCP tools an assistant has, so a task's checks judge
// what was made rather than what the agent said it made. Read-only: it never writes.
import { resultJson, resultText } from './mcp-client.mjs';

// The outline's first line names the tab's pages: `tab 3be5 "Flow" · 53 elements: 53 boxes · 6 pages: 6 wireframe
// (view pages) · rev 5`.
export function parseTabHeader(line) {
  const pages = /· (\d+) pages?: ([^(]+)\(/.exec(line);
  const pageKinds = {};
  for (const m of (pages?.[2] ?? '').matchAll(/(\d+) ([\w-]+)/g)) pageKinds[m[2]] = Number(m[1]);
  return pages ? { pageCount: Number(pages[1]), pageKinds } : {};
}

async function readTab(client, designId, tab) {
  const json = resultJson(
    await client.call('read_design', { designId, tabId: tab.id, format: 'json' }),
  );
  const outline = resultText(await client.call('read_design', { designId, tabId: tab.id }));
  return {
    id: tab.id,
    name: tab.name,
    ...parseTabHeader(outline?.split('\n')[0] ?? ''),
    elements: json?.tab?.elements ?? [],
    outline,
    pages: resultText(
      await client.call('read_design', { designId, tabId: tab.id, view: 'pages' }),
    ),
  };
}

async function snapshotDesign(client, designId) {
  const first = resultJson(await client.call('read_design', { designId, format: 'json' }));
  if (!first) return { id: designId, missing: true };
  const tabs = [];
  for (const tab of first.tabs ?? []) tabs.push(await readTab(client, designId, tab));
  return { id: designId, name: first.name, tabs };
}

export async function snapshot(client, designIds) {
  const designs = [];
  for (const id of designIds) designs.push(await snapshotDesign(client, id));
  return { designs };
}
