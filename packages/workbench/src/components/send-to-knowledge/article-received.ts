// The Sent From chip on a knowledgebase page (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The chips"):
// after a paragraph that links to a place another app sent from, the source app's logo and the source's current name,
// for a reader who can open the source (knowledge-received-store.ts). Matched by the link, so editing the line's words
// never loses it; never written into the text, typed over or exported. A plain button drawn outside React.
//
// As article-sent.ts, this package holds no ProseMirror: the editor hands in its own Decoration and DecorationSet and
// builds its Plugin from `articleReceivedSpec`. A redraw carries article-sent's meta, so the editor's own `onlySent`
// already leaves it uncommitted.
import type { App } from '@liveworkspace/index-client';
import { workbench } from '../../bindings';
import { CHIP, CHIP_OPEN, brandMarkDom } from '../send-to-plan/article-send-dom';
import type { ArticleSentDraw, PMState } from '../send-to-plan/article-sent';
import { anyReceived, onReceivedChanged, receivedAt } from './knowledge-received-store';

type PMMark = { readonly type: { readonly name: string }; readonly attrs: Record<string, unknown> };
type PMChild = { readonly marks: readonly PMMark[] };
type PMBlock = {
  readonly attrs: { readonly [attr: string]: unknown };
  readonly isTextblock: boolean;
  readonly nodeSize: number;
  forEach(f: (child: PMChild) => void): void;
};
type PMDocOf = { forEach(f: (node: PMBlock, offset: number) => void): void };
type PMView = {
  readonly state: PMState;
  readonly isDestroyed: boolean;
  dispatch(tr: ReturnType<PMState['tr']['setMeta']>): void;
};

// article-sent's redraw meta: the editor already skips its commit.
const SENT = 'article-sent';

/** The links a block holds, in order. */
function linksOf(block: PMBlock): string[] {
  const hrefs: string[] = [];
  block.forEach((child) => {
    for (const mark of child.marks)
      if (mark.type.name === 'link' && typeof mark.attrs.href === 'string')
        hrefs.push(mark.attrs.href);
  });
  return hrefs;
}

/** Opens a source in its app, at the place sent, in a new browser tab. */
function openSource(link: string): void {
  workbench.track('UI', 'Opened', 'SentKnowledge');
  window.open(link, '_blank', 'noopener,noreferrer');
}

export function receivedChipDom(source: { app: App; title: string }, link: string): HTMLElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.contentEditable = 'false';
  button.dataset.receivedChip = '';
  button.className = `${CHIP} ${CHIP_OPEN}`;
  const name = source.title || 'Untitled';
  button.setAttribute('aria-label', `Open “${name}” in ${source.app}`);
  button.title = `${name}. Opens in ${source.app}.`;
  button.appendChild(brandMarkDom(source.app, 12));
  const words = document.createElement('span');
  words.className = 'truncate';
  words.textContent = name;
  button.appendChild(words);
  // A press never moves the caret or starts a selection in the writing.
  button.addEventListener('mousedown', (e) => e.preventDefault());
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSource(link);
  });
  return button;
}

/** The plugin's spec: a chip after each paragraph linking to a received place, redrawn when the reads change. */
export function articleReceivedSpec<Deco, Set, State extends PMState>(
  draw: ArticleSentDraw<Deco, Set, State>,
) {
  const decorations = (state: State): Set => {
    // Most pages received nothing: no walk on each keystroke.
    if (!anyReceived()) return draw.empty;
    const decos: Deco[] = [];
    (state.doc as unknown as PMDocOf).forEach((node, pos) => {
      if (!node.isTextblock) return;
      for (const href of linksOf(node)) {
        const received = receivedAt(href);
        if (!received) continue;
        decos.push(
          draw.widget(pos + node.nodeSize - 1, () => receivedChipDom(received.source, href), {
            side: 3,
            marks: [],
            ignoreSelection: true,
            key: `received:${received.id}:${received.source.title}`,
          }),
        );
        break;
      }
    });
    return decos.length > 0 ? draw.set(state.doc, decos) : draw.empty;
  };
  return {
    props: { decorations },
    view(view: PMView) {
      const stop = onReceivedChanged(() => {
        if (!view.isDestroyed)
          view.dispatch(view.state.tr.setMeta(SENT, true).setMeta('addToHistory', false));
      });
      return { destroy: stop };
    },
  };
}
