import type { ArrowElement, Element, ShapeElement, Tab } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import {
  computeTabSaveDiff,
  createTab,
  deriveTabLoadState,
  mergeAiElements,
  patchTab,
  placeholdersFromSummaries,
  pruneMapToPresent,
  resolveDiagramSession,
} from './editor-page-helpers';

function tab(id: string, name = id, elements: Tab['elements'] = []): Tab {
  return { id, name, elements };
}

function foldered(id: string, folder: string): Tab {
  return { id, name: id, elements: [], folder };
}

describe('createTab', () => {
  it('mints a tab with a fresh id, the given name, and no elements', () => {
    const t = createTab('Tab 1');
    expect(t.name).toBe('Tab 1');
    expect(t.elements).toEqual([]);
    expect(typeof t.id).toBe('string');
    expect(t.id.length).toBeGreaterThan(0);
  });

  it('defaults the per-tab text size to small (spec/28)', () => {
    expect(createTab('Tab 1').defaultTextSize).toBe('sm');
  });
});

describe('placeholdersFromSummaries', () => {
  it('materialises a fresh Tab 1 when the API returns zero summaries (never empty)', () => {
    // An empty tabs array makes activeTab undefined and crashes the
    // editor on first elements read, so this guard is load-bearing.
    const out = placeholdersFromSummaries([]);
    expect(out).toHaveLength(1);
    expect(out[0]!.name).toBe('Tab 1');
    expect(out[0]!.elements).toEqual([]);
  });

  it('maps summaries to empty-element placeholder tabs preserving id + name + order', () => {
    const out = placeholdersFromSummaries([
      { id: 'a', name: 'Overview' },
      { id: 'b', name: 'Backend' },
    ]);
    expect(out.map((t) => [t.id, t.name])).toEqual([
      ['a', 'Overview'],
      ['b', 'Backend'],
    ]);
    expect(out.every((t) => t.elements.length === 0)).toBe(true);
  });

  it('carries folder membership from the summary (spec/30)', () => {
    const out = placeholdersFromSummaries([
      { id: 'a', name: 'Overview', folder: 'Org' },
      { id: 'b', name: 'Backend' },
    ]);
    expect(out.map((t) => t.folder)).toEqual(['Org', undefined]);
  });
});

describe('patchTab', () => {
  it('patches the matching tab and returns NON-matching tabs by reference', () => {
    const a = tab('a');
    const b = tab('b');
    const out = patchTab([a, b], 'a', { name: 'Renamed' });
    expect(out[0]).toEqual({ ...a, name: 'Renamed' });
    // Identity preservation is load-bearing: the autosave diff compares
    // tabs by reference, so an untouched tab must keep its identity.
    expect(out[1]).toBe(b);
  });

  it('is a no-op clone when no id matches', () => {
    const a = tab('a');
    const out = patchTab([a], 'zzz', { name: 'x' });
    expect(out[0]).toBe(a);
  });
});

describe('computeTabSaveDiff (autosave decision kernel)', () => {
  it('reports no changes when prev === current (stable references, same name)', () => {
    const tabs = [tab('a'), tab('b')];
    const diff = computeTabSaveDiff(tabs, tabs, 'Doc', 'Doc');
    expect(diff.hasChanges).toBe(false);
    expect(diff.changedTabs).toEqual([]);
    expect(diff.deletedIds).toEqual([]);
    expect(diff.orderChanged).toBe(false);
    expect(diff.nameChanged).toBe(false);
  });

  it('flags a content-changed tab by identity (new reference), skipping untouched ones', () => {
    const a = tab('a');
    const b = tab('b');
    const aEdited = { ...a, elements: [...a.elements] }; // new reference for a
    const diff = computeTabSaveDiff([a, b], [aEdited, b], 'Doc', 'Doc');
    expect(diff.changedTabs.map((t) => t.id)).toEqual(['a']);
    expect(diff.hasChanges).toBe(true);
    expect(diff.orderChanged).toBe(false);
  });

  it('flags a diagram rename via nameChanged', () => {
    const tabs = [tab('a')];
    const diff = computeTabSaveDiff(tabs, tabs, 'Old', 'New');
    expect(diff.nameChanged).toBe(true);
    expect(diff.hasChanges).toBe(true);
    expect(diff.changedTabs).toEqual([]);
  });

  it('flags an added tab as orderChanged (length differs)', () => {
    const a = tab('a');
    const diff = computeTabSaveDiff([a], [a, tab('b')], 'Doc', 'Doc');
    expect(diff.orderChanged).toBe(true);
    expect(diff.hasChanges).toBe(true);
    expect(diff.deletedIds).toEqual([]);
  });

  it('reports a removed tab in deletedIds (and orderChanged)', () => {
    const a = tab('a');
    const b = tab('b');
    const diff = computeTabSaveDiff([a, b], [a], 'Doc', 'Doc');
    expect(diff.deletedIds).toEqual(['b']);
    expect(diff.orderChanged).toBe(true);
    expect(diff.hasChanges).toBe(true);
  });

  it('flags a pure reorder as orderChanged with no changed/deleted tabs', () => {
    const a = tab('a');
    const b = tab('b');
    const diff = computeTabSaveDiff([a, b], [b, a], 'Doc', 'Doc');
    expect(diff.orderChanged).toBe(true);
    expect(diff.changedTabs).toEqual([]);
    expect(diff.deletedIds).toEqual([]);
    expect(diff.hasChanges).toBe(true);
  });

  it('flags a folder-only change as orderChanged so it rides the meta save (spec/30)', () => {
    const a = tab('a');
    const b = tab('b');
    const bFoldered = { ...b, folder: 'Org' };
    // Same ids, same positions — only b's folder changed. The meta
    // save (gated on orderChanged) must still fire.
    const diff = computeTabSaveDiff([a, b], [a, bFoldered], 'Doc', 'Doc');
    expect(diff.orderChanged).toBe(true);
    expect(diff.hasChanges).toBe(true);
  });

  it('does not flag orderChanged when folders are unchanged', () => {
    const tabs = [foldered('a', 'Org'), tab('b')];
    const diff = computeTabSaveDiff(tabs, tabs, 'Doc', 'Doc');
    expect(diff.orderChanged).toBe(false);
    expect(diff.hasChanges).toBe(false);
  });

  it('treats empty-string and undefined folder as the same (no false positive)', () => {
    const a = tab('a');
    const aEmpty = { ...a, folder: '' };
    const diff = computeTabSaveDiff([a], [aEmpty], 'Doc', 'Doc');
    expect(diff.orderChanged).toBe(false);
  });

  it('does NOT persist an unloaded, empty tab whose reference was bumped (data-loss guard)', () => {
    // The wipe bug: a background tab the user never opened is a lazy
    // placeholder (empty elements). A folder move / reorder bumps its
    // object reference, the identity diff flags it "changed", and without
    // the guard the autosave PUTs the empty body over the real server row.
    const a = tab('a'); // loaded + edited
    const b = tab('b'); // never opened: empty placeholder
    const aEdited = { ...a, elements: [...a.elements] };
    const bBumped = { ...b }; // new reference, still empty, still unloaded
    const loaded = new Set(['a']);
    const diff = computeTabSaveDiff([a, b], [aEdited, bBumped], 'Doc', 'Doc', loaded);
    expect(diff.changedTabs.map((t) => t.id)).toEqual(['a']);
    expect(diff.hasChanges).toBe(true);
  });

  it('still persists an unloaded tab that actually carries elements (peer-delivered content)', () => {
    // The guard keys on "do we have authoritative content?", not merely
    // "is it in the loaded set" — a tab a realtime peer handed us has real
    // elements and must still save even before our own fetch records it.
    const a = tab('a');
    const peer = tab('p', 'p', [
      {
        id: 'e',
        type: 'shape',
        shape: 'square',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      } as Tab['elements'][number],
    ]);
    const peerEdited = { ...peer, elements: [...peer.elements] };
    const diff = computeTabSaveDiff([a, peer], [a, peerEdited], 'Doc', 'Doc', new Set(['a']));
    expect(diff.changedTabs.map((t) => t.id)).toEqual(['p']);
  });

  it('combines edits, deletes, reorders, and a rename in one diff', () => {
    const a = tab('a');
    const b = tab('b');
    const c = tab('c');
    const cEdited = { ...c, name: 'C2' };
    // start [a,b,c] "Doc" -> end [c-edited, a] "Doc2": b deleted, c
    // edited + moved to front, a moved back, name changed.
    const diff = computeTabSaveDiff([a, b, c], [cEdited, a], 'Doc', 'Doc2');
    expect(diff.changedTabs.map((t) => t.id)).toEqual(['c']);
    expect(diff.deletedIds).toEqual(['b']);
    expect(diff.orderChanged).toBe(true);
    expect(diff.nameChanged).toBe(true);
    expect(diff.hasChanges).toBe(true);
  });
});

describe('resolveDiagramSession (owner / role / share-code security)', () => {
  it('owner: always edit, no share code, can edit the log — even when arriving via a share URL', () => {
    const s = resolveDiagramSession({
      diagramOwnerId: 'me',
      selfId: 'me',
      shareRole: 'view', // a stale view code on the owner's own URL must not downgrade them
      shareCodeParam: 'CODE2345',
    });
    expect(s.isOwner).toBe(true);
    expect(s.sessionRole).toBe('edit');
    expect(s.sessionShareCode).toBeNull();
    expect(s.canEditLog).toBe(true);
  });

  it('edit-role visitor: inherits edit, carries their code, can edit the log', () => {
    const s = resolveDiagramSession({
      diagramOwnerId: 'someone-else',
      selfId: 'me',
      shareRole: 'edit',
      shareCodeParam: 'CODE2345',
    });
    expect(s.isOwner).toBe(false);
    expect(s.sessionRole).toBe('edit');
    expect(s.sessionShareCode).toBe('CODE2345');
    expect(s.canEditLog).toBe(true);
  });

  it('view-role visitor: stays view, carries their code, CANNOT edit the log', () => {
    const s = resolveDiagramSession({
      diagramOwnerId: 'someone-else',
      selfId: 'me',
      shareRole: 'view',
      shareCodeParam: 'CODE2345',
    });
    expect(s.isOwner).toBe(false);
    expect(s.sessionRole).toBe('view');
    expect(s.sessionShareCode).toBe('CODE2345');
    expect(s.canEditLog).toBe(false);
  });
});

describe('pruneMapToPresent (realtime presence cleanup)', () => {
  it('drops entries whose participant left, keeping the present ones', () => {
    const prev = new Map([
      ['ann', 't1'],
      ['bob', 't2'],
      ['cat', 't3'],
    ]);
    const out = pruneMapToPresent(prev, new Set(['ann', 'cat']));
    expect([...out.entries()]).toEqual([
      ['ann', 't1'],
      ['cat', 't3'],
    ]);
  });

  it('returns the SAME reference when nothing was removed (identity preserved for memo)', () => {
    // Load-bearing: a fresh Map on every presence ping would re-render
    // every presence consumer even when the roster is unchanged.
    const prev = new Map([
      ['ann', 't1'],
      ['bob', 't2'],
    ]);
    expect(pruneMapToPresent(prev, new Set(['ann', 'bob']))).toBe(prev);
    // A superset of present ids also counts as "nothing removed".
    expect(pruneMapToPresent(prev, new Set(['ann', 'bob', 'zoe']))).toBe(prev);
  });

  it('returns a new empty map when everyone left', () => {
    const prev = new Map([['ann', 't1']]);
    const out = pruneMapToPresent(prev, new Set<string>());
    expect(out).not.toBe(prev);
    expect(out.size).toBe(0);
  });

  it('preserves null values (cursor/selection maps store null for "no position")', () => {
    const prev = new Map<string, string | null>([
      ['ann', null],
      ['bob', 'el-1'],
    ]);
    const out = pruneMapToPresent(prev, new Set(['ann']));
    expect([...out.entries()]).toEqual([['ann', null]]);
  });
});

describe('deriveTabLoadState', () => {
  const base = {
    hydrated: true,
    hasDiagram: true,
    loaded: false,
    errored: false,
    elementsLength: 0,
    templateChosen: false,
  };

  it('is ready before hydration / with no diagram (diagram-level loader owns the screen)', () => {
    expect(deriveTabLoadState({ ...base, hydrated: false })).toBe('ready');
    expect(deriveTabLoadState({ ...base, hasDiagram: false })).toBe('ready');
  });

  it('loads an unfetched, empty tab so the empty-canvas card never flashes', () => {
    expect(deriveTabLoadState(base)).toBe('loading');
  });

  it('errors when the fetch failed, even before content arrives', () => {
    expect(deriveTabLoadState({ ...base, errored: true })).toBe('error');
  });

  it('error wins over loaded (a refetch that fails should re-surface the error)', () => {
    expect(deriveTabLoadState({ ...base, loaded: true, errored: true })).toBe('error');
  });

  it('is ready once the tab is loaded', () => {
    expect(deriveTabLoadState({ ...base, loaded: true })).toBe('ready');
  });

  it('is ready for an unloaded tab that already carries elements (peer-delivered content)', () => {
    // No spinner over real content: a realtime peer can hand us a tab
    // body before our own lazy fetch records it as loaded.
    expect(deriveTabLoadState({ ...base, elementsLength: 3 })).toBe('ready');
  });

  it('is ready for an unloaded tab whose template picker was dismissed', () => {
    expect(deriveTabLoadState({ ...base, templateChosen: true })).toBe('ready');
  });

  it('gates editing: only the ready state is editable, loading + error are not', () => {
    // useEditorState folds this into `editsBlocked` (editable iff
    // 'ready'), so EVERY commit-based mutator — keyboard shortcuts, paste,
    // AI apply, import, clear — is refused while a tab loads or errors.
    // The pointer-only canvas overlay can't block window keydown / paste,
    // so this derived gate is the real lock; the two must agree.
    const editable = (i: Parameters<typeof deriveTabLoadState>[0]) =>
      deriveTabLoadState(i) === 'ready';
    expect(editable(base)).toBe(false); // loading
    expect(editable({ ...base, errored: true })).toBe(false); // error
    expect(editable({ ...base, loaded: true })).toBe(true); // ready
    expect(editable({ ...base, elementsLength: 3 })).toBe(true); // peer content
  });
});

describe('mergeAiElements (spec/25 AI apply)', () => {
  // Grid-aligned coords so autoAlignElements is a no-op and assertions
  // on geometry / structure stay stable.
  const sq = (id: string, o: Partial<ShapeElement> = {}): ShapeElement => ({
    id,
    type: 'shape',
    shape: 'square',
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    ...o,
  });
  const pinned = (id: string, fromId: string, toId: string): ArrowElement => ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: fromId, anchor: 'e' },
    to: { kind: 'pinned', elementId: toId, anchor: 'w' },
  });
  const byId = (els: Element[], id: string) => els.find((e) => e.id === id);

  it('generate: modifies a matching id in place and appends new elements', () => {
    const existing = [sq('a', { label: 'Old' })];
    const out = mergeAiElements(
      existing,
      [sq('a', { label: 'New' }), sq('b', { x: 200 })],
      'generate',
    );
    expect(out.map((e) => e.id).sort()).toEqual(['a', 'b']);
    expect(byId(out, 'a')?.label).toBe('New');
  });

  it('clean: never changes what an element IS, only how it looks', () => {
    // The destructive path. Clean asks the model to return ALL elements with
    // the same ids, and the client coerces any shape outside AI_SHAPE_KINDS to
    // 'square' so a NEW off-vocabulary node still renders. Spread over the
    // original that rewrote the stored kind, so one Clean flattened every
    // composite in the tab — checklists, code blocks, charts, lanes, entities,
    // progress rings, 30 of the 51 ShapeKinds — then autosaved, change-logged
    // and broadcast the result.
    const existing = [sq('a', { shape: 'checklist', label: 'Retro' })];
    const squashed = sq('a', { shape: 'square', label: 'Retro' });
    const out = mergeAiElements(existing, [squashed], 'clean');
    const a = byId(out, 'a') as ShapeElement;
    expect(a.shape).toBe('checklist');
  });

  it('clean: keeps the element type when the model returns a different one', () => {
    // Same rule, other half of identity: `type` is not on Clean's list either.
    const existing = [sq('a', { label: 'Box' })];
    const retyped = { id: 'a', type: 'text', label: 'Box' } as unknown as Element;
    const out = mergeAiElements(existing, [retyped], 'clean');
    expect(byId(out, 'a')?.type).toBe('shape');
  });

  it('generate: still replaces in place, identity included', () => {
    // The rule is Clean-specific. Generate owns the elements it produced, so
    // pinning identity there would stop it correcting its own output.
    const existing = [sq('a', { shape: 'square' })];
    const out = mergeAiElements(existing, [sq('a', { shape: 'diamond' })], 'generate');
    expect((byId(out, 'a') as ShapeElement).shape).toBe('diamond');
  });

  it('clean: preserves AI-invisible props (e.g. fillColor) by spreading the patch', () => {
    const existing = [sq('a', { label: 'Box', fillColor: '#abcdef' })];
    // The AI returns the element WITHOUT fillColor (it never sees colours).
    const out = mergeAiElements(existing, [sq('a', { label: 'Renamed' })], 'clean');
    const a = byId(out, 'a') as ShapeElement;
    expect(a.label).toBe('Renamed'); // patch applied
    expect(a.fillColor).toBe('#abcdef'); // colour preserved
  });

  it('appends non-clashing additions with ids intact and preserves an arrow between them', () => {
    const existing = [sq('keep')];
    const n1 = sq('new1', { x: 200, label: 'A' });
    const n2 = sq('new2', { x: 400, label: 'B' });
    const out = mergeAiElements(existing, [n1, n2, pinned('arr', 'new1', 'new2')], 'generate');
    expect(out.map((e) => e.id).sort()).toEqual(['arr', 'keep', 'new1', 'new2']);
    const arrow = out.find((e) => e.type === 'arrow') as ArrowElement;
    // No id clash → endpoints keep pointing at the additions verbatim.
    expect(arrow.from.kind === 'pinned' && arrow.from.elementId).toBe('new1');
    expect(arrow.to.kind === 'pinned' && arrow.to.elementId).toBe('new2');
  });

  it('does not drop or duplicate elements (modifications replace, additions append)', () => {
    const existing = [sq('a'), sq('b', { x: 200 })];
    // One modification (id 'a') + one genuine addition (id 'c').
    const out = mergeAiElements(
      existing,
      [sq('a', { label: 'mod' }), sq('c', { x: 400 })],
      'generate',
    );
    expect(out.map((e) => e.id).sort()).toEqual(['a', 'b', 'c']);
    expect((byId(out, 'a') as ShapeElement).label).toBe('mod');
  });
});
