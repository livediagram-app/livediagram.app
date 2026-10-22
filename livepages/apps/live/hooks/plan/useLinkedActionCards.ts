'use client';

// The Actions board in the editor (docs/specs/026-plan/linked-boards.md): every action in the document has a card on
// it, and the two stay one thing. The board is made the first time someone adds an action; after that an Editor's
// editor heals what it can see a moment after things settle (healLinkedCards); a card a person trashes takes its
// action off the canvas (and an undo or Restore this session puts it back); an action that goes leaves its card on the
// board as a card of its own (and an undo links them again).
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ElementActionAssignee, Tab } from '@livepages/document';
import {
  ITEM_BULK_MAX,
  cardLink,
  healLinkedCards,
  isTrashed,
  itemPersonId,
  linkedCardLeftPatch,
  linkedCardId,
  linkedCardsTrashedBy,
  type Item,
  type ItemPatchOf,
  type ItemPerson,
  type ItemStoreState,
  type ItemWrite,
  type LinkedRecord,
} from '@livepages/items';
import { actionsBoardTab } from '@livepages/templates';
import { colorForKey } from '@/lib/identity';
import { debugLog } from '@/lib/debug-log';
import { track } from '@/lib/telemetry';
import { useLatest } from '@/hooks/ui/useLatest';
import type { CollabDeepLink } from '@/lib/collab-deep-link';
import type { PlanItems } from './usePlanItems';
import { PLAN_SWEEP_MAX_TABS } from './usePlanTabSweep';
import {
  actionsBoardIn,
  applyActionChanges,
  goneActionIds,
  placedActions,
  removeAction,
  restoreAction,
  unloadedTabIds,
  type CollectingBoard,
  type PlacedAction,
} from './linked-actions';

// How long after the last change the heal waits (blueprint linked-boards.md "Constants"): long enough for the person
// who changed one side to have written the other, and for a burst of room ops to land, so a heal writes once.
export const LINKED_HEAL_DEBOUNCE_MS = 600;

// The key an assignee is hashed by: their account, else their team membership (an invited member).
function assigneeKey(a: ElementActionAssignee): string | null {
  return a.userId ?? (a.memberId ? `member:${a.memberId}` : null);
}

export type LinkedActions = {
  board: CollectingBoard | null;
  // The editor added an action on `tabId`: make the Actions board when the document has none.
  noteActionAdded: (tabId: string) => void;
  // A person's own item write, before it applies: a linked card sent to the Trash takes its action with it.
  noteOwnWrite: (write: ItemWrite, before: ItemStoreState) => void;
  // Opens the Actions board on an action's card ("Where it went"); absent with no board.
  openOnBoard: ((actionId?: string) => void) | null;
  // Where a linked card's action is, by name, for the item panel's banner; null for a card that is not linked.
  placeOf: (item: Item) => { tabName: string } | null;
  // Opens the canvas at a linked card's action ("On the board").
  showOnCanvas: (item: Item) => void;
};

export function useLinkedActionCards(deps: {
  tabs: Tab[];
  loadedTabIds: ReadonlySet<string>;
  // The document's Actions board (actionsBoardIn), worked out once by the editor.
  board: CollectingBoard | null;
  items: Pick<PlanItems, 'store' | 'items' | 'status' | 'writeQuiet'>;
  // An Editor's editor heals; only an Editor who may add tabs makes the board.
  canHeal: boolean;
  canMakeBoard: boolean;
  statusNames: ReadonlyMap<string, string>;
  commitTabs: (fn: (ts: Tab[]) => Tab[]) => void;
  tickTabs: (fn: (ts: Tab[]) => Tab[]) => void;
  markTabLoaded: (id: string) => void;
  // Brings the card types a new board names into the document's catalogue (usePresetCardTypes): the Action type.
  bringCardTypes: (elements: Tab['elements']) => void;
  loadTabs: (only?: readonly string[]) => Promise<unknown>;
  arrive: (link: CollabDeepLink) => void;
  announceBoard: (message: string, open: () => void) => void;
}): LinkedActions {
  const { tabs, loadedTabIds, items, canHeal, board } = deps;
  const placed = useMemo(() => placedActions(tabs, loadedTabIds), [tabs, loadedTabIds]);
  const live = useLatest({ ...deps, placed });

  // Assignees as Plan names people (a one-way hash, docs/specs/026-plan/blueprints/item-store.md "Security and
  // trust"), worked out once per person.
  const [people, setPeople] = useState<ReadonlyMap<string, ItemPerson>>(new Map());
  useEffect(() => {
    const wanted = new Map<string, string>();
    for (const { action } of placed) {
      const key = assigneeKey(action.assignee);
      if (key && !people.has(key)) wanted.set(key, action.assignee.name?.trim() || 'Teammate');
    }
    if (!wanted.size) return;
    let alive = true;
    void Promise.all(
      [...wanted].map(
        async ([key, name]) =>
          [key, { id: await itemPersonId(key), name, color: colorForKey(key) }] as const,
      ),
    ).then((made) => {
      if (alive) setPeople((prev) => new Map([...prev, ...made]));
    });
    return () => {
      alive = false;
    };
  }, [placed, people]);

  // A document with actions reads its other tabs once, so an Actions board on a tab nobody opened is found (and its
  // cards' items loaded). Bounded as the Plan sweep is (usePlanTabSweep): a longer document finds its board when the
  // board's tab is opened, or when someone adds an action (noteActionAdded reads every tab first).
  const tabsAsked = useRef(false);
  useEffect(() => {
    if (board || !placed.length || tabsAsked.current || tabs.length > PLAN_SWEEP_MAX_TABS) return;
    const ids = unloadedTabIds(tabs, loadedTabIds);
    if (!ids.length) return;
    tabsAsked.current = true;
    void live.current.loadTabs(ids);
  }, [board, placed.length, tabs, loadedTabIds, live]);

  // Actions this session took off the canvas with their trashed card, to put back if the card comes back.
  const removed = useRef(new Map<string, PlacedAction>());

  // An action that went (deleted, or its element or tab was) leaves its card on the board, a card of its own.
  const seen = useRef<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const gone = goneActionIds(seen.current, placed);
    seen.current = new Set(placed.map((p) => p.action.id));
    const now = live.current;
    if (!gone.length || !now.canHeal || !now.board || now.items.status !== 'ready') return;
    const patches = gone.flatMap((id) => {
      if (removed.current.has(id)) return [];
      const card = now.items.items.get(linkedCardId('actions', id));
      return card ? (linkedCardLeftPatch(card) ?? []) : [];
    });
    if (!patches.length) return;
    debugLog('[linked] action.gone.card.unlinked', { count: patches.length });
    void writePatches(now.items.writeQuiet, patches);
  }, [placed, live]);

  // The heal, a moment after the last change.
  useEffect(() => {
    if (!canHeal || !board || items.status !== 'ready') return;
    const timer = setTimeout(() => {
      const now = live.current;
      if (!now.board) return;
      const records: LinkedRecord[] = [];
      for (const p of now.placed) {
        const key = assigneeKey(p.action.assignee);
        const person = key ? people.get(key) : null;
        // Not hashed yet: heal once it is, rather than clear the card's assignee and set it again.
        if (person === undefined) return;
        records.push({
          id: p.action.id,
          tabId: p.tabId,
          elementId: p.elementId,
          title: p.action.name,
          description: p.action.description,
          status: p.action.status,
          updatedAt: p.action.updatedAt,
          assignee: person,
        });
      }
      const heal = healLinkedCards({
        kind: 'actions',
        records,
        items: now.items.items,
        setup: now.board.setup,
        typeId: 'action',
        now: Date.now(),
      });
      if (heal.creates.length || heal.patches.length || heal.records.length)
        debugLog('[linked] heal', {
          creates: heal.creates.length,
          patches: heal.patches.length,
          records: heal.records.length,
        });
      for (let i = 0; i < heal.creates.length; i += ITEM_BULK_MAX)
        void now.items.writeQuiet(
          { kind: 'create', creates: heal.creates.slice(i, i + ITEM_BULK_MAX) },
          { silent: true },
        );
      void writePatches(now.items.writeQuiet, heal.patches);
      if (heal.records.length)
        now.tickTabs((ts) => applyActionChanges(ts, heal.records, now.loadedTabIds));
      // A trashed card that came back (an undo, Restore) brings its action back with it.
      for (const [id, was] of removed.current) {
        const card = now.items.items.get(linkedCardId('actions', id));
        if (card && isTrashed(card)) continue;
        removed.current.delete(id);
        if (card) now.tickTabs((ts) => restoreAction(ts, was, now.loadedTabIds));
      }
    }, LINKED_HEAL_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [canHeal, board, items.status, items.store, placed, people, live]);

  // One board in the making at a time: a second action added while the first's tabs load waits on nothing and adds
  // nothing.
  const making = useRef(false);
  const noteActionAdded = (tabId: string) => {
    if (making.current) return;
    making.current = true;
    void (async () => {
      try {
        const now = live.current;
        if (!now.canMakeBoard || now.board) return;
        const unloaded = unloadedTabIds(now.tabs, now.loadedTabIds);
        if (unloaded.length) await now.loadTabs(unloaded);
        // Read after the fetch: a board on a tab it just brought is never doubled.
        const after = live.current;
        if (actionsBoardIn(after.tabs)) return;
        const made = actionsBoardTab(
          after.tabs.find((t) => t.id === tabId),
          after.statusNames,
        );
        after.commitTabs((ts) => (actionsBoardIn(ts) ? ts : [...ts, made]));
        after.markTabLoaded(made.id);
        after.bringCardTypes(made.elements);
        track('Action', 'Linked', 'Board');
        debugLog('[linked] board.made', { tabId: made.id });
        after.announceBoard('Added to Your Actions Board', () =>
          live.current.arrive({
            at: { tabId: made.id, elementId: made.elements[0]!.id },
            open: null,
            itemId: null,
          }),
        );
        // Every action already in the document gets its card as its tab loads: a document with a board sweeps its
        // tabs in once (usePlanTabSweep, bounded), and the heal reads each as it lands.
      } finally {
        making.current = false;
      }
    })();
  };

  const noteOwnWrite = (write: ItemWrite, before: ItemStoreState) => {
    const now = live.current;
    if (!now.canHeal) return;
    const trashed = linkedCardsTrashedBy(write, before);
    for (const card of trashed) {
      const link = cardLink(card)!;
      const at = now.placed.find((p) => p.action.id === link.recordId);
      if (!at) continue;
      removed.current.set(link.recordId, at);
      now.tickTabs((ts) => removeAction(ts, link.recordId, now.loadedTabIds));
      debugLog('[linked] card.trashed.action.removed', { actionId: link.recordId });
    }
  };

  const openOnBoard = (actionId?: string) => {
    const b = live.current.board;
    if (!b) return;
    track('Action', 'Opened', 'Board');
    live.current.arrive({
      at: { tabId: b.tabId, elementId: b.elementId },
      open: null,
      itemId: actionId ? linkedCardId('actions', actionId) : null,
    });
  };

  // Which tab each action is on, by name: kept by its content, so a canvas edit that moves no action and renames no
  // tab leaves placeOf (and the Plan context it rides in) as it was.
  const tabNamesKey = JSON.stringify([
    placed.map((p) => [p.action.id, p.tabId]),
    tabs.map((t) => [t.id, t.name]),
  ]);
  const placeOf = useMemo(() => {
    const [actionTabs, tabNames] = JSON.parse(tabNamesKey) as [
      [string, string][],
      [string, string][],
    ];
    const tabOf = new Map(actionTabs);
    const names = new Map(tabNames);
    return (item: Item) => {
      const link = cardLink(item);
      if (!link) return null;
      const name = names.get(tabOf.get(link.recordId) ?? link.tabId);
      return name === undefined ? null : { tabName: name };
    };
  }, [tabNamesKey]);

  const showOnCanvas = (item: Item) => {
    const link = cardLink(item);
    if (!link) return;
    const at = live.current.placed.find((p) => p.action.id === link.recordId);
    track('Action', 'Opened', 'Canvas');
    live.current.arrive({
      at: { tabId: at?.tabId ?? link.tabId, elementId: at?.elementId ?? link.elementId },
      open: 'action',
      itemId: null,
    });
  };

  return {
    board,
    noteActionAdded,
    noteOwnWrite,
    openOnBoard: board ? openOnBoard : null,
    placeOf,
    showOnCanvas,
  };
}

async function writePatches(writeQuiet: PlanItems['writeQuiet'], patches: readonly ItemPatchOf[]) {
  for (let i = 0; i < patches.length; i += ITEM_BULK_MAX)
    await writeQuiet(
      { kind: 'patches', patches: patches.slice(i, i + ITEM_BULK_MAX) },
      { silent: true },
    );
}
