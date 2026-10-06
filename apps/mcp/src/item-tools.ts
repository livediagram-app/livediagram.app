// The item tools (docs/specs/026-plan/plan-mode.md "Agents", docs/specs/015-api/mcp-server.md): read and
// change the items a document's Plan boards show, through the item store's routes. An item is named by its
// number ("#12") or an id prefix (resolveItemRef), the way the CLI's item verbs name it. Every change
// reaches people's boards at once, through the room.
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { itemsPath } from '@livediagram/agent-verbs';
import type { ItemResponse, ItemsResponse } from '@livediagram/api-schema';
import {
  itemStatus,
  itemSummary,
  itemTitle,
  resolveItemRef,
  type Item,
  type ItemFields,
} from '@livediagram/items';
import { ApiError, apiFetch, apiJson } from './api';
import type { Env } from './env';
import { registerTool } from './tool-annotations';
import { mcpChangeItems, mcpListItems } from '@livediagram/agent-verbs/mcp';
import { deepLink, errorResult, requireToken, textResult, type Extra } from './tool-helpers';

const outOf = (item: Item) => ({
  ref: `#${item.key}`,
  id: item.id,
  type: item.type,
  status: itemStatus(item) ?? null,
  title: itemTitle(item),
  fields: item.fields as Record<string, unknown>,
});

class Unnamed extends Error {}

function named(items: Item[], ref: string): Item {
  const found = resolveItemRef(items, ref);
  if (found.ok) return found.item;
  throw new Unnamed(
    found.reason === 'ambiguous'
      ? `"${ref}" names more than one item: ${found.matches.map(itemSummary).join('; ')}`
      : `No item "${ref}". List them with list_items.`,
  );
}

export function registerItemTools(server: McpServer, env: Env): void {
  registerTool(server, env, mcpListItems, async (args, extra) => {
    const token = requireToken(extra as Extra);
    const { items } = await apiJson<ItemsResponse>(env, token, itemsPath(args.documentId));
    const shown = items
      .filter((i) => !args.type || i.type === args.type)
      .filter((i) => !args.status || itemStatus(i) === args.status)
      .sort((a, b) => a.key - b.key);
    return textResult({
      count: shown.length,
      items: shown.map(outOf),
      url: deepLink(args.documentId),
    });
  });

  registerTool(server, env, mcpChangeItems, async (args, extra) => {
    const token = requireToken(extra as Extra);
    const base = itemsPath(args.documentId);
    let { items } = await apiJson<ItemsResponse>(env, token, base);
    const applied: string[] = [];
    const post = (path: string, body: unknown) =>
      apiJson<ItemResponse>(env, token, path, { method: 'POST', body: JSON.stringify(body) });
    const keep = (item: Item) => {
      items = [...items.filter((i) => i.id !== item.id), item];
    };
    try {
      for (const c of args.changes) {
        if (c.op === 'add') {
          const { item } = await post(base, {
            type: c.type,
            fields: { ...(c.fields as ItemFields | undefined), title: c.title },
            ...(c.status ? { place: { status: c.status } } : {}),
          });
          keep(item);
          applied.push(`+ ${itemSummary(item)}`);
        } else if (c.op === 'set') {
          const target = named(items, c.item);
          const { item } = await post(`${base}/${encodeURIComponent(target.id)}`, {
            ...(c.fields ? { set: c.fields } : {}),
            ...(c.clear?.length ? { clear: c.clear } : {}),
            ...(c.type ? { type: c.type } : {}),
          });
          keep(item);
          applied.push(`~ ${itemSummary(item)}`);
        } else if (c.op === 'move') {
          const target = named(items, c.item);
          const before = c.before ? named(items, c.before).id : null;
          const { item } = await post(`${base}/${encodeURIComponent(target.id)}/move`, {
            status: c.status,
            before,
          });
          keep(item);
          applied.push(`→ ${itemSummary(item)} in ${c.status}`);
        } else {
          const target = named(items, c.item);
          const res = await apiFetch(env, token, `${base}/${encodeURIComponent(target.id)}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new ApiError(res.status, await res.text());
          items = items.filter((i) => i.id !== target.id);
          applied.push(`- ${itemSummary(target)}`);
        }
      }
    } catch (err) {
      const done = applied.length ? ` Applied before it: ${applied.join('; ')}.` : '';
      if (err instanceof Unnamed) return errorResult(`${err.message}${done}`);
      if (err instanceof ApiError && err.status === 400)
        return errorResult(`The api refused a change (${err.code ?? 'invalid'}).${done}`);
      throw err;
    }
    return textResult({ applied, url: deepLink(args.documentId) });
  });
}
