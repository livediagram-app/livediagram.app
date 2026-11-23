'use client';

// The item as rules read it in the browser (blueprint item-ui.md "The helper", "Sentence, needs, picks",
// "Performance"): the editor's view of it, the names a rule is worded by, what it has (for what a rule needs), and
// its snapshots, read once and only when something shows them. `buildOutline` is the pure half; the hook holds the
// two read-once lists and asks for each when a listed rule names a snapshot or a connection.

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  itemNames,
  refsOf,
  type ItemHave,
  type ItemKinds,
  type ItemRefKind,
} from '@liveworkspace/automations/item';
import { useAutomationsAccess } from '../AutomationsContext';
import { useAutomations } from '../use-automations';
import { onceStore, type OnceState } from './once-store';
import { snapshotListStore, useSnapshotList } from './snapshot-list';
import type {
  ItemAutomationsKitInput,
  ItemSnapshot,
  ItemSnapshots,
  ItemTabTemplate,
  ItemUiOutline,
  ItemView,
} from './types';

type Named = { id: string; name: string };

const WHEN: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
};

/** A snapshot as people pick it: its name, or when it was taken for one with none. */
export const snapshotLabel = (snapshot: Pick<ItemSnapshot, 'name' | 'createdAt'>): string =>
  snapshot.name?.trim() ||
  `Snapshot of ${new Date(snapshot.createdAt).toLocaleString(undefined, WHEN)}`;

const idsOf = (list: readonly { id: string }[]): ReadonlySet<string> =>
  new Set(list.map((x) => x.id));
const namesOf = (list: readonly Named[]): ReadonlyMap<string, string> =>
  new Map(list.map((x) => [x.id, x.name]));

/** The outline over what is known now. A list not read yet is left out of `names` and `have`, so a rule naming a
 *  snapshot reads by the name it kept and is not called gone. */
export function buildOutline(o: {
  kinds: Pick<ItemKinds, 'itemWord' | 'tabTemplates'>;
  item: ItemView;
  templates: readonly ItemTabTemplate[];
  snapshots: ItemSnapshots;
  connections: OnceState<Named>;
}): ItemUiOutline {
  const snapshots = o.snapshots.status === 'ready' ? o.snapshots.list : null;
  const connections = o.connections.status === 'ready' ? o.connections.list : null;
  const have: ItemHave = {
    tab: idsOf(o.item.tabs),
    person: idsOf(o.item.people),
    ...(o.kinds.tabTemplates ? { template: idsOf(o.templates) } : {}),
    ...(snapshots ? { snapshot: idsOf(snapshots) } : {}),
    ...(connections ? { connection: idsOf(connections) } : {}),
  };
  return {
    item: o.item,
    names: itemNames(o.kinds.itemWord, o.item, {
      templates: namesOf(o.templates),
      ...(snapshots ? { snapshots: new Map(snapshots.map((s) => [s.id, snapshotLabel(s)])) } : {}),
      ...(connections ? { connections: namesOf(connections) } : {}),
    }),
    have,
    snapshots: o.snapshots,
    templates: o.templates,
  };
}

/** Which read-once lists the rules name something of. */
export function listsNamed(rules: readonly unknown[] | undefined): ReadonlySet<ItemRefKind> {
  const kinds = new Set<ItemRefKind>();
  for (const ref of refsOf(rules ?? [])) if (ref.id) kinds.add(ref.kind);
  return kinds;
}

const NO_TEMPLATES: readonly ItemTabTemplate[] = [];

/** The kit's `useOutline`, over the app's own reads. Made once per kit: its two lists are the kit's. */
export function makeUseItemOutline(
  input: Pick<
    ItemAutomationsKitInput,
    'kinds' | 'plumbing' | 'useItem' | 'snapshots' | 'tabTemplates' | 'indexClient'
  >,
): () => ItemUiOutline {
  const snapshotLists = snapshotListStore();
  const connectionLists = onceStore<Named>();
  const templates = input.tabTemplates ?? NO_TEMPLATES;
  const { client } = input.plumbing;

  return function useItemOutline(): ItemUiOutline {
    const item = input.useItem();
    const { id, shareCode, signedIn } = item;
    // The rules the list holds (read by the screen): what they name decides what is worth reading.
    const scope = useAutomationsAccess()?.scope ?? null;
    const rules = useAutomations(client, scope, false).data?.rules;
    const named = useMemo(() => listsNamed(rules), [rules]);

    const onConnections = useCallback(
      (listener: () => void) => connectionLists.subscribe(id, listener),
      [id],
    );
    const getConnections = useCallback(() => connectionLists.get(id), [id]);
    const connections = useSyncExternalStore(onConnections, getConnections, getConnections);

    const readSnapshots = useCallback(() => input.snapshots({ id, shareCode }), [id, shareCode]);
    // Both lists live as long as something shows the outline (the screen), and go with it.
    const snapshots = useSnapshotList(snapshotLists, id, readSnapshots, named.has('snapshot'));
    useEffect(() => connectionLists.hold(id), [id]);
    // Connections are an account's: a guest's rules are not checked against them.
    const wantsConnections = named.has('connection') && signedIn;
    useEffect(() => {
      if (!wantsConnections) return;
      connectionLists.ask(id, async () => {
        const got = await input.indexClient.listWebhooks(
          id,
          shareCode ? { code: shareCode } : null,
        );
        return got.webhooks.map((w) => ({ id: w.id, name: w.name }));
      });
    }, [wantsConnections, id, shareCode]);

    return useMemo(
      () =>
        buildOutline({
          kinds: input.kinds,
          item,
          templates,
          snapshots,
          connections,
        }),
      [item, snapshots, connections],
    );
  };
}
