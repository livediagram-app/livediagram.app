// add_tab with a C4 template links the C4 levels (docs/specs/008-canvas/canvas-and-palette.md "Templates", the C4
// levels link to each other; docs/specs/015-api/mcp-server.md §4.3a): the editor's own rule (linkC4Levels in
// @livediagram/templates), its new links written as one `set` changeset per tab they land on, so anyone with the
// document open sees them arrive and a person's change since is kept.
import type { DocumentResponse } from '@livediagram/api-schema';
import { elementFingerprint, type Tab } from '@livediagram/document';
import { linkC4Levels, type TemplateKind } from '@livediagram/templates';
import type { Env } from '@liveworkspace/mcp-kit/env';
import { apiJson } from './api';
import { submitChangeset } from './changeset-client';
import { getTab } from './template-elements';

type StoredTab = Tab & { rev: number };

/** Whether a template kind is a level of the C4 model, whose tab links to the others. */
export const isC4Template = (kind: TemplateKind | null): boolean =>
  !!kind && kind.startsWith('c4-');

/** The changesets that write the links linkC4Levels makes through the landed tab: per tab it changes, a `set` of
 *  each new link, based on the elements as read. Pure. */
export function c4LinkChangesets(
  tabs: readonly StoredTab[],
  landedId: string,
): {
  tabId: string;
  operations: unknown[];
  base: { rev: number; elements: Record<string, string> };
}[] {
  const linked = linkC4Levels(tabs, landedId);
  return tabs.flatMap((tab, i) => {
    const next = linked[i]!;
    if (next === tab) return [];
    const before = new Map(tab.elements.map((el) => [el.id, el]));
    const operations: unknown[] = [];
    const elements: Record<string, string> = {};
    for (const el of next.elements) {
      const was = before.get(el.id);
      if (!was || was === el || !('link' in el)) continue;
      operations.push({ op: 'set', target: el.id, fields: { link: el.link } });
      elements[el.id] = elementFingerprint(was);
    }
    return [{ tabId: tab.id, operations, base: { rev: tab.rev, elements } }];
  });
}

/** Links the C4 levels through the tab just made: a note saying how many links were made, or that they could not
 *  be, or null when there were none to make. */
export async function linkC4LevelsOnAddTab(
  env: Env,
  token: string,
  documentId: string,
  landedId: string,
): Promise<string | null> {
  try {
    const { document } = await apiJson<DocumentResponse>(
      env,
      token,
      `/documents/${encodeURIComponent(documentId)}`,
    );
    const tabs = (await Promise.all(
      document.tabs.map((t) => getTab(env, token, documentId, t.id)),
    )) as StoredTab[];
    const changesets = c4LinkChangesets(tabs, landedId);
    if (changesets.length === 0) return null;
    let made = 0;
    for (const { tabId, operations, base } of changesets) {
      await submitChangeset(env, token, documentId, tabId, { operations, base });
      made += operations.length;
    }
    return `Linked the C4 levels: ${made} element${made === 1 ? '' : 's'} now open${made === 1 ? 's' : ''} the level ${made === 1 ? 'it names' : 'they name'}.`;
  } catch {
    return 'The tab was made, but its C4 level could not be linked to the others; link them from the editor.';
  }
}
