import type { Tab } from '@liveplanner/project';
import { describe, expect, it } from 'vitest';
import {
  mayShareProject,
  autosaveReadOnly,
  computeTabSaveDiff,
  createTab,
  deriveTabLoadState,
  patchTab,
  placeholdersFromSummaries,
  pruneMapToPresent,
  resolveProjectSession,
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

  it('defaults the per-tab text size to small (docs/specs/004-interface-design/fonts.md)', () => {
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

  it('carries folder membership from the summary (docs/specs/006-project/tab-folders.md)', () => {
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

  it('flags a content-changed tab, skipping untouched ones', () => {
    const a = tab('a');
    const b = tab('b');
    const aEdited = { ...a, name: 'a (edited)' }; // new reference, new content
    const diff = computeTabSaveDiff([a, b], [aEdited, b], 'Doc', 'Doc');
    expect(diff.changedTabs.map((t) => t.id)).toEqual(['a']);
    expect(diff.hasChanges).toBe(true);
    expect(diff.orderChanged).toBe(false);
  });

  // docs/specs/012-collaboration/collab-race-hardening.md: a peer's op is applied to the screen and to the baseline
  // separately, so the two hold equal content in different objects. That is
  // not a local change and must not be saved (or broadcast) back.
  it('does not flag a new reference whose content is unchanged', () => {
    const a = tab('a');
    const diff = computeTabSaveDiff([a], [{ ...a, elements: [...a.elements] }], 'Doc', 'Doc');
    expect(diff.changedTabs).toEqual([]);
    expect(diff.hasChanges).toBe(false);
  });

  it('compares the rest of the tab key by key: a deep change is caught, an equal copy is not', () => {
    const a = { ...tab('a'), pages: [{ id: 'p1', title: 'One' }] } as unknown as ReturnType<
      typeof tab
    >;
    const copy = { ...a, pages: [{ id: 'p1', title: 'One' }] } as unknown as typeof a;
    const edited = { ...a, pages: [{ id: 'p1', title: 'Two' }] } as unknown as typeof a;
    const added = { ...a, font: 'lora' } as typeof a;
    expect(computeTabSaveDiff([a], [copy], 'Doc', 'Doc').hasChanges).toBe(false);
    expect(computeTabSaveDiff([a], [edited], 'Doc', 'Doc').changedTabs.map((t) => t.id)).toEqual([
      'a',
    ]);
    expect(computeTabSaveDiff([a], [added], 'Doc', 'Doc').changedTabs.map((t) => t.id)).toEqual([
      'a',
    ]);
  });

  it('flags a project rename via nameChanged', () => {
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

  it('flags a folder-only change as orderChanged so it rides the meta save (docs/specs/006-project/tab-folders.md)', () => {
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
    const aEdited = { ...a, name: 'a (edited)' };
    const bBumped = { ...b, name: 'b (renamed)' }; // bumped, still empty, still unloaded
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
      },
    ]);
    const peerEdited = { ...peer, name: 'p (edited)' };
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

describe('resolveProjectSession (owner / role / share-code security)', () => {
  // docs/specs/013-workspace/share-roles.md: a Participant link opens at its level; its embed only looks.
  it('opens a Participant link as a Participant, and its embed as a Viewer', () => {
    const base = { projectOwnerId: 'owner', selfId: 'visitor', shareCodeParam: 'C' };
    expect(resolveProjectSession({ ...base, shareRole: 'participate' }).sessionRole).toBe(
      'participate',
    );
    expect(
      resolveProjectSession({ ...base, shareRole: 'participate', embed: true }).sessionRole,
    ).toBe('view');
    expect(resolveProjectSession({ ...base, shareRole: 'edit', embed: true }).sessionRole).toBe(
      'edit',
    );
  });

  it('owner: always edit, no share code, even when arriving via a share URL', () => {
    const s = resolveProjectSession({
      projectOwnerId: 'me',
      selfId: 'me',
      shareRole: 'view', // a stale view code on the owner's own URL must not downgrade them
      shareCodeParam: 'CODE2345',
    });
    expect(s.isOwner).toBe(true);
    expect(s.sessionRole).toBe('edit');
    expect(s.sessionShareCode).toBeNull();
  });

  it('edit-role visitor: inherits edit, carries their code', () => {
    const s = resolveProjectSession({
      projectOwnerId: 'someone-else',
      selfId: 'me',
      shareRole: 'edit',
      shareCodeParam: 'CODE2345',
    });
    expect(s.isOwner).toBe(false);
    expect(s.sessionRole).toBe('edit');
    expect(s.sessionShareCode).toBe('CODE2345');
  });

  it('view-role visitor: stays view, carries their code', () => {
    const s = resolveProjectSession({
      projectOwnerId: 'someone-else',
      selfId: 'me',
      shareRole: 'view',
      shareCodeParam: 'CODE2345',
    });
    expect(s.isOwner).toBe(false);
    expect(s.sessionRole).toBe('view');
    expect(s.sessionShareCode).toBe('CODE2345');
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
    hasProject: true,
    loaded: false,
    errored: false,
    elementsLength: 0,
    templateChosen: false,
  };

  it('is ready before hydration / with no project (project-level loader owns the screen)', () => {
    expect(deriveTabLoadState({ ...base, hydrated: false })).toBe('ready');
    expect(deriveTabLoadState({ ...base, hasProject: false })).toBe('ready');
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
    // import, clear — is refused while a tab loads or errors.
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

// docs/specs/007-editor/load-recovery.md "Offline": a failed load once saved the editor's empty default
// tab into the real project when the connection came back.
describe('autosaveReadOnly', () => {
  it('writes only a project that loaded and can be edited', () => {
    expect(autosaveReadOnly({ canEdit: true, loadError: false, projectNotFound: false })).toBe(
      false,
    );
    expect(autosaveReadOnly({ canEdit: false, loadError: false, projectNotFound: false })).toBe(
      true,
    );
    expect(autosaveReadOnly({ canEdit: true, loadError: true, projectNotFound: false })).toBe(true);
    expect(autosaveReadOnly({ canEdit: true, loadError: false, projectNotFound: true })).toBe(true);
  });
});

// docs/specs/013-workspace/team-shared-projects.md: a team's projects belong to every joined member.
describe('mayShareProject', () => {
  it('lets the owner share, team or not', () => {
    expect(mayShareProject({ isOwner: true, teamId: null, sessionShareCode: null })).toBe(true);
    expect(mayShareProject({ isOwner: true, teamId: 't1', sessionShareCode: null })).toBe(true);
  });

  it('lets a teammate who opened a team project without a code share it', () => {
    expect(mayShareProject({ isOwner: false, teamId: 't1', sessionShareCode: null })).toBe(true);
  });

  it('keeps share-link visitors as visitors, team project or not', () => {
    expect(mayShareProject({ isOwner: false, teamId: null, sessionShareCode: 'c1' })).toBe(false);
    expect(mayShareProject({ isOwner: false, teamId: 't1', sessionShareCode: 'c1' })).toBe(false);
    expect(mayShareProject({ isOwner: false, teamId: null, sessionShareCode: null })).toBe(false);
  });
});
