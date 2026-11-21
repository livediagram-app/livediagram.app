// Tab folders for agents (each product's docs/specs/006-*/tab-folders.md "Agents"): what the MCP's change_tabs and
// add_tab's `folder`, and the CLI's `tab folder` and `tab add --folder`, do to a file's tabs. A folder is only a name
// on each tab's link row, so a change is planned here over the file's tabs in order, normalised with
// normalizeFolderOrder, and written whole through the tab-order write the editor's save path uses
// (`PUT /<collection>/:id` with `tabs`), which tells everyone with the file open.

import { ApiError, type ApiClient } from '@liveworkspace/api-client';
import { normalizeFolderOrder, tabFolderName } from '@liveworkspace/element-model/tab-folders';
import type { AgentProduct } from './product';

// A folder name is the same text the editor's dialogs write; a long one is refused rather than cut.
export const TAB_FOLDER_NAME_MAX = 60;

// The most changes one change_tabs call applies, as change_threads takes.
export const TAB_FOLDER_CHANGES_MAX = 50;

export type TabFolderChange =
  | { op: 'move'; tab: string; folder: string | null }
  | { op: 'rename_folder'; folder: string; to: string }
  | { op: 'ungroup'; folder: string };

// A tab as the api lists it (an older answer may lack the order, read as its place in the list).
export type FolderedTab = { id: string; name: string; orderIndex?: number; folder?: string };

// A tab as read_document and `tab ls` list it: the folder only when it has one.
export type ListedTab = { id: string; name: string; folder?: string };

// One entry of the tab-order write: every tab, in its new place, with its folder (null is loose).
type OrderEntry = { id: string; folder: string | null };

// A tab while the changes are planned: the folder as normalizeFolderOrder reads it (absent is loose).
type Planned = { id: string; folder?: string };

// A change refused before anything was written, in words a model can act on.
export class TabFolderStop extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TabFolderStop';
  }
}

const inOrder = <T extends { orderIndex?: number }>(tabs: readonly T[]): T[] =>
  [...tabs].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

/** A file's tabs in order, each with its folder when it has one. */
export function listedTabsOf(tabs: readonly FolderedTab[]): ListedTab[] {
  return inOrder(tabs).map((t) => {
    const folder = tabFolderName(t);
    return folder === null ? { id: t.id, name: t.name } : { id: t.id, name: t.name, folder };
  });
}

const tabsLine = (tabs: readonly Planned[], names: ReadonlyMap<string, string>) =>
  tabs.map((t) => `${names.get(t.id)} (${t.id})`).join(', ');

const foldersOf = (tabs: readonly Planned[]) => [
  ...new Set(tabs.flatMap((t) => (t.folder === undefined ? [] : [t.folder]))),
];

function folderNamed(given: string, what: string): string {
  const name = given.trim();
  if (!name) throw new TabFolderStop(`${what} is empty: name the folder.`);
  if (name.length > TAB_FOLDER_NAME_MAX)
    throw new TabFolderStop(
      `${what} "${name.slice(0, 20)}…" is longer than ${TAB_FOLDER_NAME_MAX} characters.`,
    );
  return name;
}

/**
 * The tabs after the changes, applied in order, each seeing the ones before it. Joining a folder that exists places
 * the tab after its last member, so the folder never moves to the tab and no other tab changes place; leaving one
 * lands the tab just outside it (normalizeFolderOrder's run): before it from its head, else after it. An unknown tab or folder throws TabFolderStop,
 * before anything is written. `lines` says what each change did.
 */
export function planTabFolders(
  tabs: readonly FolderedTab[],
  changes: readonly TabFolderChange[],
): { tabs: OrderEntry[]; lines: string[]; changed: boolean } {
  const before: Planned[] = inOrder(tabs).map((t) => {
    const folder = tabFolderName(t);
    return folder === null ? { id: t.id } : { id: t.id, folder };
  });
  const names = new Map(tabs.map((t) => [t.id, t.name]));
  const quoted = (id: string) => JSON.stringify(names.get(id));
  let list = before.map((t) => ({ ...t }));
  const lines: string[] = [];

  const tabNamed = (given: string): Planned => {
    const byId = list.find((t) => t.id === given);
    if (byId) return byId;
    const key = given.trim().toLowerCase();
    const named = list.filter((t) => names.get(t.id)!.trim().toLowerCase() === key);
    if (named.length === 1) return named[0]!;
    throw new TabFolderStop(
      named.length > 1
        ? `${named.length} tabs are named "${given}": name it by its id. Tabs: ${tabsLine(list, names)}.`
        : `No tab "${given}". Tabs: ${tabsLine(list, names)}.`,
    );
  };
  const existingFolder = (given: string): string => {
    const name = given.trim();
    if (list.some((t) => t.folder === name)) return name;
    const folders = foldersOf(list);
    throw new TabFolderStop(
      `No folder "${given}". ${folders.length ? `Folders: ${folders.map((f) => JSON.stringify(f)).join(', ')}.` : 'No tab is in a folder.'}`,
    );
  };

  for (const change of changes) {
    if (change.op === 'move') {
      const tab = tabNamed(change.tab);
      const folder = change.folder === null ? undefined : folderNamed(change.folder, 'The folder');
      if (tab.folder === folder) {
        lines.push(
          `= tab ${quoted(tab.id)} ${folder === undefined ? 'is in no folder' : `is in "${folder}"`} already`,
        );
        continue;
      }
      const joins = folder !== undefined && list.some((t) => t.folder === folder);
      if (folder === undefined) delete tab.folder;
      else tab.folder = folder;
      if (joins) {
        // After the folder's last member, so the folder keeps its place.
        list = list.filter((t) => t !== tab);
        const last = list.findLastIndex((t) => t.folder === folder);
        list.splice(last + 1, 0, tab);
      }
      list = normalizeFolderOrder(list);
      lines.push(
        folder === undefined
          ? `~ tab ${quoted(tab.id)} out of its folder`
          : `~ tab ${quoted(tab.id)} into ${joins ? '' : 'new '}folder "${folder}"`,
      );
    } else if (change.op === 'rename_folder') {
      const from = existingFolder(change.folder);
      const to = folderNamed(change.to, 'The new name');
      if (from === to) {
        lines.push(`= folder "${from}" is named that already`);
        continue;
      }
      const merges = list.some((t) => t.folder === to);
      for (const t of list) if (t.folder === from) t.folder = to;
      list = normalizeFolderOrder(list);
      lines.push(
        `~ folder "${from}" renamed "${to}"${merges ? ', joining the folder of that name' : ''}`,
      );
    } else {
      const folder = existingFolder(change.folder);
      const members = list.filter((t) => t.folder === folder);
      for (const t of members) delete t.folder;
      lines.push(
        `~ folder "${folder}" ungrouped: ${members.length} tab${members.length === 1 ? '' : 's'} out`,
      );
    }
  }
  const changed = list.some((t, i) => t.id !== before[i]!.id || t.folder !== before[i]!.folder);
  return { tabs: list.map((t) => ({ id: t.id, folder: t.folder ?? null })), lines, changed };
}

export type TabFolderRun = Pick<AgentProduct, 'noun' | 'collection' | 'word'>;

const filePath = (product: TabFolderRun, id: string) =>
  `/${product.collection}/${encodeURIComponent(id)}`;

async function readTabs(api: ApiClient, product: TabFolderRun, id: string) {
  const answer = await api.json<Record<string, { tabs: FolderedTab[] }>>(filePath(product, id));
  return answer[product.noun]!.tabs;
}

// The api's refusal of the write, in words: the tab-order write is an Editor's alone.
function refusedWrite(err: unknown, product: TabFolderRun): never {
  if (err instanceof ApiError && err.status === 403)
    throw new TabFolderStop(
      `Only an Editor can change tab folders, and you can only view or participate in this ${product.word ?? product.noun}.`,
    );
  throw err;
}

async function writeTabs(
  api: ApiClient,
  product: TabFolderRun,
  id: string,
  tabs: readonly OrderEntry[],
): Promise<FolderedTab[]> {
  try {
    const answer = await api.json<Record<string, { tabs: FolderedTab[] }>>(filePath(product, id), {
      method: 'PUT',
      body: JSON.stringify({ tabs }),
    });
    return answer[product.noun]!.tabs;
  } catch (err) {
    return refusedWrite(err, product);
  }
}

/**
 * change_tabs: the changes planned over the file's tabs as they are now, then written as one tab-order write (none
 * when nothing changes). Answers each change's line and the tabs as they now stand.
 */
export async function changeTabFolders(
  api: ApiClient,
  product: TabFolderRun,
  id: string,
  changes: readonly TabFolderChange[],
  // The tabs as the caller just read them, else read here.
  known?: readonly FolderedTab[],
): Promise<{ applied: string[]; tabs: ListedTab[] }> {
  const tabs = known ?? (await readTabs(api, product, id));
  const plan = planTabFolders(tabs, changes);
  if (!plan.changed) return { applied: plan.lines, tabs: listedTabsOf(tabs) };
  const written = await writeTabs(api, product, id, plan.tabs);
  return { applied: plan.lines, tabs: listedTabsOf(written) };
}

/** add_tab's `folder`: the new tab, made loose at the end, moved into the folder named (an existing one, or new). */
export async function fileNewTab(
  api: ApiClient,
  product: TabFolderRun,
  id: string,
  tabId: string,
  folder: string,
): Promise<string> {
  const plan = planTabFolders(await readTabs(api, product, id), [
    { op: 'move', tab: tabId, folder },
  ]);
  if (plan.changed) await writeTabs(api, product, id, plan.tabs);
  return plan.tabs.find((t) => t.id === tabId)!.folder!;
}

/** A TabFolderStop's words, else undefined (the error is not one of ours). */
export const tabFolderStopText = (err: unknown): string | undefined =>
  err instanceof TabFolderStop ? err.message : undefined;
