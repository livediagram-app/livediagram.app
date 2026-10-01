// Replaying a board's change history (docs/specs/020-import-export/whiteboard-import.md
// "Replay"): changes in time order, undone changes left out, each edit applied to the tree; an
// edit naming a node no longer there is skipped and counted, never thrown.
import { MSWB_COMMAND, MSWB_COMMAND_TRAIT, MSWB_TRAIT, MSWB_TYPE } from './format';
import { buildNode, children, createIndex, unindex, type TreeIndex, type WbNode } from './tree';

export type ReplayStats = {
  changes: number;
  applied: number;
  undone: number;
  skippedEdits: number;
  /** Replaces whose old value was already gone; their new value still lands. */
  staleReplaces: number;
  /** Inserts whose sibling was gone; they land last (on top). */
  misplacedInserts: number;
  ignoredCommands: number;
};

export type ReplayedBoard = {
  root: WbNode;
  /** The canvas: its children trait is the board's element list, back to front. */
  canvas: WbNode | null;
  index: TreeIndex;
  stats: ReplayStats;
  /** Image object ids by the id of the image node they fill (the changes' `deferred`). */
  imageObjects: Map<string, string>;
};

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** Changes in replay order: timestamp, then sync order. */
export function orderChanges(changes: Rec[]): Rec[] {
  const stamp = (c: Rec) => (isRecord(c.gch) ? (str(c.gch.dtu) ?? '') : '');
  const order = (c: Rec) => (typeof c.changeOrder === 'number' ? c.changeOrder : 0);
  return [...changes].sort((a, b) => {
    const sa = stamp(a);
    const sb = stamp(b);
    return sa < sb ? -1 : sa > sb ? 1 : order(a) - order(b);
  });
}

/** The ids of the changes undo has taken out (and redo has not put back), walking in order. */
export function undoneChanges(ordered: Rec[]): Set<string> {
  const byId = new Map<string, Rec>();
  for (const c of ordered) if (str(c.fuid)) byId.set(c.fuid as string, c);
  const targets = (c: Rec) =>
    isRecord(c.gch) && Array.isArray(c.gch.fuids)
      ? c.gch.fuids.filter((f): f is string => typeof f === 'string')
      : [];
  const undone = new Set<string>();
  for (const c of ordered) {
    if (c.type === 'FchUndo') for (const t of targets(c)) undone.add(t);
    if (c.type === 'FchRedo')
      for (const t of targets(c)) {
        const target = byId.get(t);
        if (target?.type === 'FchUndo') for (const u of targets(target)) undone.delete(u);
        else undone.delete(t);
      }
  }
  return undone;
}

type Place = { parent?: string; trait?: string; after?: string; before?: string };

class Replayer {
  /** Where the last taken run stood, for a replace or a failed move. */
  private lastTakeIndex = 0;
  readonly stats: ReplayStats = {
    changes: 0,
    applied: 0,
    undone: 0,
    skippedEdits: 0,
    staleReplaces: 0,
    misplacedInserts: 0,
    ignoredCommands: 0,
  };
  readonly index: TreeIndex;
  constructor(index: TreeIndex) {
    this.index = index;
  }

  private list(parent: string | undefined, trait: string | undefined): WbNode[] | null {
    const node = parent ? this.index.nodes.get(parent) : undefined;
    if (!node || !trait) return null;
    let list = node.traits.get(trait);
    if (!list) node.traits.set(trait, (list = []));
    return list;
  }

  private build(raws: unknown): WbNode[] {
    if (!Array.isArray(raws)) return [];
    const out: WbNode[] = [];
    for (const raw of raws) {
      const node = buildNode(raw, this.index);
      if (node) out.push(node);
    }
    return out;
  }

  /** Where a place is: after `after`, before `before`, else first; null when it is gone. */
  private slot(place: Place): { list: WbNode[]; at: number } | null {
    const list = this.list(place.parent, place.trait);
    if (!list) return null;
    const sibling = place.after ?? place.before;
    if (!sibling) return { list, at: 0 };
    const i = list.findIndex((n) => n.id === sibling);
    if (i < 0) return null;
    return { list, at: place.after ? i + 1 : i };
  }

  /** Removes the run first..last, returning it, or null when the run is gone. */
  private take(parent?: string, trait?: string, first?: string, last?: string): WbNode[] | null {
    const list = this.list(parent, trait);
    if (!list || !first || !last) return null;
    const i = list.findIndex((n) => n.id === first);
    const j = list.findIndex((n) => n.id === last);
    if (i < 0 || j < i) return null;
    this.lastTakeIndex = i;
    return list.splice(i, j - i + 1);
  }

  private skip() {
    this.stats.skippedEdits++;
  }

  insert(place: Place, raws: unknown) {
    // Built only once the place is known, so a skipped insert leaves the index untouched.
    const slot = this.slot(place);
    if (slot) return void slot.list.splice(slot.at, 0, ...this.build(raws));
    const list = this.list(place.parent, place.trait);
    if (!list) return this.skip();
    // The sibling is gone (deleted or never synced): the new nodes still land, on top.
    this.stats.misplacedInserts++;
    list.push(...this.build(raws));
  }

  remove(parent?: string, trait?: string, first?: string, last?: string, raws?: unknown) {
    const list = this.list(parent, trait);
    const run = this.take(parent, trait, first, last);
    if (list && !run && raws !== undefined) {
      // A replace of a value a concurrent edit already replaced: it still sets its value, and
      // single-valued reads take the latest.
      this.stats.staleReplaces++;
      return void list.splice(0, 0, ...this.build(raws));
    }
    if (!list || !run) return this.skip();
    const at = this.lastTakeIndex;
    for (const n of run) unindex(n, this.index);
    if (raws !== undefined) list.splice(at, 0, ...this.build(raws));
  }

  move(source: Place & { first?: string; last?: string }, target: Place) {
    const run = this.take(source.parent, source.trait, source.first, source.last);
    if (!run) return this.skip();
    const slot = this.slot(target);
    if (slot) return void slot.list.splice(slot.at, 0, ...run);
    // The destination is gone: put the run back where it was rather than lose it.
    this.list(source.parent, source.trait)!.splice(this.lastTakeIndex, 0, ...run);
    this.skip();
  }

  command(raw: unknown) {
    if (!isRecord(raw) || !Array.isArray(raw.traits)) return void this.stats.ignoredCommands++;
    const traits = new Map<string, Rec[]>();
    for (const t of raw.traits)
      if (isRecord(t) && typeof t.trait === 'string' && Array.isArray(t.children))
        traits.set(t.trait, t.children.filter(isRecord));
    const ref = (name: string) => str(traits.get(name)?.[0]?.fuid);
    const named = (name: string) => str(traits.get(name)?.[0]?.nrefIsa);
    const T = MSWB_COMMAND_TRAIT;
    const parent = ref(T.parent);
    const trait = named(T.trait);
    switch (raw.nrefIsa) {
      case MSWB_COMMAND.insert:
        return this.insert(
          { parent, trait, after: ref(T.afterSibling), before: ref(T.beforeSibling) },
          traits.get(T.content) ?? [],
        );
      case MSWB_COMMAND.delete:
        return this.remove(parent, trait, ref(T.first), ref(T.last));
      case MSWB_COMMAND.replace:
        return this.remove(parent, trait, ref(T.first), ref(T.last), traits.get(T.content) ?? []);
      case MSWB_COMMAND.move:
        return this.move(
          {
            parent: ref(T.sourceParent),
            trait: named(T.sourceTrait),
            first: ref(T.sourceFirst),
            last: ref(T.sourceLast),
          },
          { parent, trait, after: ref(T.afterSibling), before: ref(T.beforeSibling) },
        );
      case MSWB_COMMAND.tag:
        return;
      default:
        this.stats.ignoredCommands++;
    }
  }

  change(c: Rec) {
    const g = isRecord(c.gch) ? c.gch : {};
    const s = (k: string) => str(g[k]);
    switch (c.type) {
      case 'FchGroup':
        if (Array.isArray(g.groupTrees)) for (const cmd of g.groupTrees) this.command(cmd);
        return;
      case 'FchInsert':
        return this.insert(
          {
            parent: s('fuidnParentDst'),
            trait: s('traitDst'),
            after: s('fuidncBeforeDst'),
            before: s('fuidncAfterDst'),
          },
          g.insertTrees,
        );
      case 'FchDelete':
        return this.remove(
          s('fuidnParentDst'),
          s('traitDst'),
          s('fuidncFirstDst'),
          s('fuidncLastDst'),
        );
      case 'FchReplace':
        return this.remove(
          s('fuidnParentDst'),
          s('traitDst'),
          s('fuidncFirstDst'),
          s('fuidncLastDst'),
          g.insertTrees ?? [],
        );
      case 'FchMove':
        return this.move(
          {
            parent: s('fuidnParentSrc'),
            trait: s('traitSrc'),
            first: s('fuidncFirstSrc'),
            last: s('fuidncLastSrc'),
          },
          {
            parent: s('fuidnParentDst'),
            trait: s('traitDst'),
            after: s('fuidncBeforeDst'),
            before: s('fuidncAfterDst'),
          },
        );
      default:
        this.stats.ignoredCommands++;
    }
  }
}

/** The canvas: root → children → layer → children → canvas, found by type. */
function findCanvas(root: WbNode): WbNode | null {
  const layer = children(root, MSWB_TRAIT.children).find((n) => n.type === MSWB_TYPE.layer);
  if (!layer) return null;
  return children(layer, MSWB_TRAIT.children).find((n) => n.type === MSWB_TYPE.canvas) ?? null;
}

/** Replays `changes` on `treeInit`; null when the starting tree is not a node. */
export function replayBoard(treeInit: unknown, changes: unknown[]): ReplayedBoard | null {
  const index = createIndex();
  const root = buildNode(treeInit, index);
  if (!root) return null;
  const replayer = new Replayer(index);
  const records = changes.filter(isRecord);
  const ordered = orderChanges(records);
  const undone = undoneChanges(ordered);
  const imageObjects = new Map<string, string>();
  replayer.stats.changes = records.length;
  for (const c of ordered) {
    if (c.type === 'FchUndo' || c.type === 'FchRedo') continue;
    if (str(c.fuid) && undone.has(c.fuid as string)) {
      replayer.stats.undone++;
      continue;
    }
    if (Array.isArray(c.deferred))
      for (const d of c.deferred)
        if (isRecord(d) && typeof d.fuid === 'string' && typeof d.id === 'string')
          imageObjects.set(d.fuid, d.id);
    const before = replayer.stats.skippedEdits + replayer.stats.ignoredCommands;
    replayer.change(c);
    if (replayer.stats.skippedEdits + replayer.stats.ignoredCommands === before)
      replayer.stats.applied++;
  }
  return { root, canvas: findCanvas(root), index, stats: replayer.stats, imageObjects };
}
