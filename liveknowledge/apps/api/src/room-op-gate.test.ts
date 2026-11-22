import { describe, expect, it } from 'vitest';
import { gateClientOp, type GateSender } from './room-op-gate';

// docs/specs/013-workspace/share-roles.md "The level ladder": what each role may relay through the room.
const as = (role: unknown, over: Partial<GateSender> = {}): GateSender => ({
  role,
  tabScope: null,
  ...over,
});
const relay = (presence: boolean) => ({ kind: 'relay', presence });
const DROP = { kind: 'drop' };

describe('gateClientOp', () => {
  it('never relays a system op from a client, whatever the role', () => {
    expect(gateClientOp({ kind: 'share-revoked', code: 'x' }, as('edit'))).toEqual(DROP);
  });

  // docs/specs/006-document/delta-saves.md "A peer's save moves the base copy": sequenced after the save's ops, an
  // Editor's alone, and a scoped session's for its own tab only.
  it("relays an Editor's and a Participant's tab-saved as a mutation, never a Viewer's", () => {
    const saved = { kind: 'tab-saved', tabId: 't', rev: 3, digest: 'a'.repeat(64) };
    expect(gateClientOp(saved, as('edit'))).toEqual(relay(false));
    expect(gateClientOp(saved, as('participate'))).toEqual(relay(false));
    expect(gateClientOp(saved, as('view'))).toEqual(DROP);
    expect(gateClientOp(saved, as('edit', { tabScope: 'other' }))).toEqual(DROP);
    expect(gateClientOp(saved, as('edit', { tabScope: 't' }))).toEqual(relay(false));
  });

  it('relays presence from anyone, mutations from an editor only', () => {
    expect(gateClientOp({ kind: 'cursor' }, as('view'))).toEqual(relay(true));
    const tab = { kind: 'tab', tabId: 't', tab: { id: 't', elements: [] } };
    expect(gateClientOp(tab, as('edit'))).toEqual(relay(false));
    expect(gateClientOp(tab, as('view'))).toEqual(DROP);
    // An unknown role reads as the lowest level.
    expect(gateClientOp(tab, as('admin'))).toEqual(DROP);
  });

  // A Participant is an Editor minus the settings, the style and automations, none of which a socket carries.
  it("relays a Participant's mutations as an Editor's", () => {
    expect(gateClientOp({ kind: 'el', tabId: 't' }, as('participate'))).toEqual(relay(false));
    for (const kind of ['el-delta', 'document-meta', 'article']) {
      expect(gateClientOp({ kind, tabId: 't' }, as('participate')), kind).toEqual(relay(false));
    }
  });

  // docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles": one row a role and action.
  describe('the knowledgebase share roles, in the room', () => {
    const page = { id: 't', elements: [] };
    const actions: [string, unknown][] = [
      ['write on a page', { kind: 'article', tabId: 't', flow: 'art-1', ops: [] }],
      ['add or duplicate a page', { kind: 'tab', tabId: 't', tab: page }],
      ['rename a page', { kind: 'tab-meta', tabId: 't', patch: { name: 'Renamed' } }],
      ['indent or outdent a page', { kind: 'tab-meta', tabId: 't', patch: { parent: 'p' } }],
      ['move or delete a page', { kind: 'document-meta', name: 'K', tabs: [] }],
      ['set a cover', { kind: 'tab-meta', tabId: 't', patch: { cover: { kind: 'gradient' } } }],
    ];
    it.each(actions)('an Editor may %s', (_label, op) => {
      expect(gateClientOp(op, as('edit'))).toEqual(relay(false));
    });
    it.each(actions)('a Participant may %s', (_label, op) => {
      expect(gateClientOp(op, as('participate'))).toEqual(relay(false));
    });
    it.each(actions)('a Viewer may not %s', (_label, op) => {
      expect(gateClientOp(op, as('view'))).toEqual(DROP);
    });
    it('commenting: an Editor and a Participant relay, a Viewer is dropped', () => {
      const comment = { kind: 'el', tabId: 't', op: { kind: 'update', id: 'e' } };
      expect(gateClientOp(comment, as('edit'))).toEqual(relay(false));
      expect(gateClientOp(comment, as('participate'))).toEqual(relay(false));
      expect(gateClientOp(comment, as('view'))).toEqual(DROP);
    });
    it('editing a page: an Editor and a Participant say so and save, a Viewer cannot claim either', () => {
      for (const kind of ['page-editing', 'page-saved']) {
        const op = { kind, tabId: 't' };
        expect(gateClientOp(op, as('edit')), kind).toEqual(relay(true));
        expect(gateClientOp(op, as('participate')), kind).toEqual(relay(true));
        expect(gateClientOp(op, as('view')), kind).toEqual(DROP);
      }
    });
  });

  it("drops a participant's op for a tab outside its link", () => {
    const scoped = as('participate', { tabScope: 't1' });
    expect(gateClientOp({ kind: 'el', tabId: 't1' }, scoped)).toEqual(relay(false));
    expect(gateClientOp({ kind: 'el', tabId: 't2' }, scoped)).toEqual(DROP);
  });

  it("relays an article frame from an editor as sent, and drops a viewer's", () => {
    expect(gateClientOp({ kind: 'article', tabId: 't' }, as('edit'))).toEqual(relay(false));
    expect(gateClientOp({ kind: 'article', tabId: 't' }, as('view'))).toEqual(DROP);
  });

  // docs/specs/012-collaboration/comment-reactions.md: an Editor's reaction rides the room, and so does a
  // Participant's, who is an Editor of the page here; a Viewer's is dropped.
  it("relays an Editor's and a Participant's comment reaction, never a Viewer's", () => {
    const react = {
      kind: 'el-delta',
      tabId: 't',
      elementId: 'e',
      delta: {
        kind: 'comment-react',
        commentId: 'c',
        emoji: 'eyes',
        by: 'me',
        name: 'Me',
        on: true,
      },
    };
    expect(gateClientOp(react, as('edit'))).toEqual(relay(false));
    expect(gateClientOp(react, as('participate'))).toEqual(relay(false));
    expect(gateClientOp(react, as('view'))).toEqual(DROP);
  });

  it("shows only a writer's drag preview", () => {
    expect(gateClientOp({ kind: 'drag-preview' }, as('edit'))).toEqual(relay(true));
    expect(gateClientOp({ kind: 'drag-preview' }, as('participate'))).toEqual(relay(true));
    expect(gateClientOp({ kind: 'drag-preview' }, as('view'))).toEqual(DROP);
  });

  it('keeps a tab-scoped session to its own tab', () => {
    const scoped = as('edit', { tabScope: 't1' });
    const tabOp = (tabId: string) => ({ kind: 'tab', tabId, tab: { id: tabId, elements: [] } });
    expect(gateClientOp(tabOp('t1'), scoped)).toEqual(relay(false));
    expect(gateClientOp(tabOp('t2'), scoped)).toEqual(DROP);
    expect(gateClientOp({ kind: 'document-meta' }, scoped)).toEqual(DROP);
  });

  it("drops a tab op whose payload names another tab, so a scoped link can't renumber its tab onto one it can't reach", () => {
    const scoped = as('edit', { tabScope: 't1' });
    // The envelope names the scoped tab; the payload, which receivers merge over it, names another.
    expect(
      gateClientOp({ kind: 'tab', tabId: 't1', tab: { id: 't2', elements: [] } }, scoped),
    ).toEqual(DROP);
    expect(gateClientOp({ kind: 'tab', tabId: 't1', tab: { elements: [] } }, scoped)).toEqual(DROP);
    expect(gateClientOp({ kind: 'tab', tabId: 't1' }, scoped)).toEqual(DROP);
    for (const key of ['id', 'elements', 'articles']) {
      expect(
        gateClientOp({ kind: 'tab-meta', tabId: 't1', patch: { [key]: 't2' } }, scoped),
      ).toEqual(DROP);
    }
    expect(gateClientOp({ kind: 'tab-meta', tabId: 't1' }, scoped)).toEqual(DROP);
    expect(
      gateClientOp({ kind: 'tab-meta', tabId: 't1', patch: { color: '#0ea5e9' } }, scoped),
    ).toEqual(relay(false));
    // A tab's name is structure (docs/specs/013-workspace/tab-scoped-share-links.md): not the scoped link's to change.
    expect(
      gateClientOp({ kind: 'tab-meta', tabId: 't1', patch: { name: 'Plan' } }, scoped),
    ).toEqual(DROP);
    expect(
      gateClientOp({ kind: 'tab-meta', tabId: 't1', patch: { name: 'Plan' } }, as('edit')),
    ).toEqual(relay(false));
    // The same holds for an unscoped editor: the payload's id is never the sender's to change.
    expect(gateClientOp({ kind: 'tab', tabId: 't1', tab: { id: 't2' } }, as('edit'))).toEqual(DROP);
  });
});
