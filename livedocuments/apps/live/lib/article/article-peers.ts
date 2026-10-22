// Collaborators' carets in the writing (docs/specs/007-editor/article-pages.md "Collaboration"):
// each one's caret in their colour, their name on it while it has just moved or on hover, and a
// thin bar in the margin beside the block they are in. Drawn as decorations, never stored: the
// carets arrive by a meta transaction (setArticlePeers), which changes no text, so it never reaches
// the history or a commit. Placed afresh from block id and offset on every change, so a caret stays
// in its block whatever is typed around it.
import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { resolveCaret } from './article-caret';
import type { ArticlePeerCaret } from './article-carets-store';

type PeersState = { peers: readonly ArticlePeerCaret[]; decorations: DecorationSet };

export const articlePeersKey = new PluginKey<PeersState>('article-peers');

function caretDom(peer: ArticlePeerCaret): HTMLElement {
  const span = document.createElement('span');
  span.className = 'article-peer-caret';
  span.style.setProperty('--article-peer', peer.color);
  span.dataset.name = peer.name;
  if (peer.fresh) span.dataset.fresh = '';
  span.setAttribute('aria-hidden', 'true');
  return span;
}

/** The decorations for `peers` in `doc`: a caret each, and a margin bar per block someone is in. */
function peerDecorations(doc: PMNode, peers: readonly ArticlePeerCaret[]): DecorationSet {
  if (peers.length === 0) return DecorationSet.empty;
  const decos: Decoration[] = [];
  const barred = new Set<number>();
  for (const peer of peers) {
    const at = resolveCaret(doc, peer);
    if (!at) continue;
    if (!barred.has(at.from)) {
      barred.add(at.from);
      decos.push(
        Decoration.node(at.from, at.to, {
          'data-peer': '',
          style: `--article-peer-bar: ${peer.color}`,
        }),
      );
    }
    if (at.pos === null) continue;
    decos.push(
      Decoration.widget(at.pos, () => caretDom(peer), {
        // A changed name, colour or freshness redraws the caret; a move alone only places it.
        key: `peer:${peer.id}:${peer.color}:${peer.name}:${peer.fresh ? 1 : 0}`,
        side: -1,
        marks: [],
        ignoreSelection: true,
      }),
    );
  }
  return DecorationSet.create(doc, decos);
}

export const articlePeersPlugin = new Plugin<PeersState>({
  key: articlePeersKey,
  state: {
    init: () => ({ peers: [], decorations: DecorationSet.empty }),
    apply(tr, value, _old, state) {
      const peers = tr.getMeta(articlePeersKey) as readonly ArticlePeerCaret[] | undefined;
      if (peers) return { peers, decorations: peerDecorations(state.doc, peers) };
      if (!tr.docChanged || value.peers.length === 0) return value;
      return { peers: value.peers, decorations: peerDecorations(state.doc, value.peers) };
    },
  },
  props: {
    decorations: (state) => articlePeersKey.getState(state)?.decorations,
  },
});

/** The transaction that puts `peers` in the writing: no text changes, nothing to undo or commit. */
export function setArticlePeers(
  state: EditorState,
  peers: readonly ArticlePeerCaret[],
): Transaction {
  return state.tr.setMeta(articlePeersKey, peers).setMeta('addToHistory', false);
}

/** Whether a transaction only brought collaborators' carets (the writing's own state is as it was). */
export function onlyPeers(tr: Transaction): boolean {
  return !!tr.getMeta(articlePeersKey) && !tr.docChanged && !tr.selectionSet;
}
