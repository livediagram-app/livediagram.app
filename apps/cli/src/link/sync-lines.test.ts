import { describe, expect, it } from 'vitest';
import { actionLine, totalsLine, type LineContext } from './sync-lines';

// What a pass prints (docs/specs/027-repositories/blueprints/repository-link.md "Output lines"): final copy, paths
// relative to the working directory.

const lc = (over: Partial<LineContext> = {}): LineContext => ({
  pathOf: (rel) => `docs/diagrams/${rel}`,
  level: 'files',
  relocate: false,
  linkHost: 'https://livediagram.app',
  ...over,
});
const doc = { documentId: 'd1', name: 'Home screen' };

describe('actionLine', () => {
  it('words writes, new and behind, with or without a file', () => {
    const tabs = [
      { id: 't1', name: 'Flow', from: 3, to: 4 },
      { id: 't2', name: 'Menu', from: 2, to: 2 },
      { id: 't3', name: 'Added', from: null, to: 1 },
    ];
    expect(
      actionLine(
        { kind: 'write', ...doc, reason: 'new', path: 'home.livediagram.json', tabs },
        lc(),
      ),
    ).toBe('+ docs/diagrams/home.livediagram.json  "Home screen" · 3 tabs · rev 4,2,1');
    expect(
      actionLine({ kind: 'write', ...doc, reason: 'new', path: null, tabs: [tabs[0]!] }, lc()),
    ).toBe('+ "Home screen" · 1 tab · rev 4');
    expect(actionLine({ kind: 'write', ...doc, reason: 'new', path: null, tabs: [] }, lc())).toBe(
      '+ "Home screen" · 0 tabs',
    );
    expect(
      actionLine(
        { kind: 'write', ...doc, reason: 'behind', path: 'home.livediagram.json', tabs },
        lc(),
      ),
    ).toBe('~ docs/diagrams/home.livediagram.json  "Home screen" · Flow, Added · rev 3→4, 1');
    expect(
      actionLine(
        {
          kind: 'write',
          ...doc,
          reason: 'behind',
          path: 'home.livediagram.json',
          tabs: [tabs[1]!],
        },
        lc(),
      ),
    ).toBe('~ docs/diagrams/home.livediagram.json  "Home screen"');
  });

  it('words removals, lowered files and relocations', () => {
    expect(
      actionLine({ kind: 'remove', ...doc, path: 'h.livediagram.json', reason: 'trashed' }, lc()),
    ).toBe('- docs/diagrams/h.livediagram.json  "Home screen" · in the Trash');
    expect(actionLine({ kind: 'remove', ...doc, path: null, reason: 'outside' }, lc())).toBe(
      '- "Home screen" · outside the link',
    );
    expect(
      actionLine({ kind: 'lower', ...doc, path: 'h.livediagram.json' }, lc({ level: 'index' })),
    ).toBe('- docs/diagrams/h.livediagram.json  "Home screen" · level index keeps no mirror files');
    const move = {
      kind: 'relocate' as const,
      ...doc,
      path: 'h.livediagram.json',
      to: 'home.livediagram.json',
    };
    expect(actionLine(move, lc())).toBe(
      '» docs/diagrams/h.livediagram.json would move to docs/diagrams/home.livediagram.json: livediagram sync --relocate',
    );
    expect(actionLine(move, lc({ relocate: true }))).toBe(
      '» docs/diagrams/h.livediagram.json → docs/diagrams/home.livediagram.json',
    );
  });

  it('words reports, transient failures, and nothing for a document in step', () => {
    expect(
      actionLine(
        { kind: 'report', reason: 'unreadable', documentId: 'd1', path: 'h.livediagram.json' },
        lc(),
      ),
    ).toBe('? docs/diagrams/h.livediagram.json: no document this account can open; left as it is');
    expect(
      actionLine({ kind: 'report', reason: 'unreadable', documentId: 'd1', path: null }, lc()),
    ).toBe('? d1: no document this account can open; left as it is');
    expect(
      actionLine(
        { kind: 'report', reason: 'local-new', documentId: null, path: 'n.livediagram.json' },
        lc(),
      ),
    ).toBe(
      '? docs/diagrams/n.livediagram.json: a document written by hand; this version of livediagram does not create it',
    );
    expect(
      actionLine(
        {
          kind: 'transient',
          ...doc,
          failure: 'https://livediagram.app is rate limiting this token',
          exit: 6,
          reason: '429',
        },
        lc(),
      ),
    ).toBe('! "Home screen": https://livediagram.app is rate limiting this token; files kept');
    expect(actionLine({ kind: 'none', ...doc, path: null }, lc())).toBeNull();
  });

  it('words every refusal', () => {
    const refuse = (reason: string, detail: string | null = null) =>
      actionLine(
        { kind: 'refuse', documentId: 'd1', path: 'h.livediagram.json', reason, detail } as never,
        lc(),
      );
    const p = 'docs/diagrams/h.livediagram.json';
    expect(refuse('ahead')).toBe(`! ${p}: changed here; send it: livediagram push ${p}`);
    expect(refuse('diverged')).toBe(
      `! ${p}: changed here and in livediagram; send it: livediagram push ${p}`,
    );
    expect(refuse('gone-changed')).toBe(
      `! ${p}: gone from the link, but changed here and not sent; kept. Send it: livediagram push ${p}, or delete it`,
    );
    expect(refuse('lowered-changed', 'none')).toBe(
      `! ${p}: level none keeps no mirror files, but this one changed here and is not sent; kept. Send it: livediagram push ${p}, or delete it`,
    );
    expect(refuse('conflicted')).toBe(
      `! ${p}: holds git conflict markers. Keep one side: git checkout --ours ${p} (or --theirs), then livediagram sync`,
    );
    expect(refuse('invalid', 'not JSON')).toBe(`! ${p}: not JSON`);
    expect(refuse('foreign-host', 'https://self.example')).toBe(
      `! ${p}: synced from https://self.example, not this link's https://livediagram.app`,
    );
    expect(refuse('duplicate', 'other.livediagram.json')).toBe(
      `! ${p}: names the same document as docs/diagrams/other.livediagram.json`,
    );
  });
});

describe('totalsLine', () => {
  it('leaves zero counts out, and says when there was nothing to do', () => {
    expect(totalsLine({ inStep: 3, written: 1, removed: 0, refused: 2, unreadable: 1 })).toBe(
      '3 in step · 1 written · 2 refused · 1 unreadable',
    );
    expect(totalsLine({ inStep: 0, written: 0, removed: 4, refused: 0, unreadable: 0 })).toBe(
      '4 removed',
    );
    expect(totalsLine({ inStep: 0, written: 0, removed: 0, refused: 0, unreadable: 0 })).toBe(
      'nothing to do',
    );
  });
});
