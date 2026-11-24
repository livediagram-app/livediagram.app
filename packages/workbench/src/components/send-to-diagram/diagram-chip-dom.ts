// A sent block's diagram chip in an article's writing (liveworkspace/docs/specs/004-index/send-to-diagram.md "The
// chip"): livediagram's logo and the newest diagram's name, +N for the rest, after the block's last word and beside
// Send to Plan's chip. A plain button drawn outside React (the writing is a ProseMirror view): never editable, never
// taking the caret, opening the diagram on its tab in a new browser tab.
import type { DiagramSend } from '@liveworkspace/index-client';
import { workbench } from '../../bindings';
import { CHIP, CHIP_OPEN, brandMarkDom } from '../send-to-plan/article-send-dom';

/** Opens a sent diagram in livediagram, on the tab drawn, in a new browser tab. */
export function openSentDiagram(send: DiagramSend): void {
  workbench.track('UI', 'Opened', 'SentDiagram');
  window.open(send.link, '_blank', 'noopener,noreferrer');
}

/** The chip's words and its hover line. */
export function diagramChipWords(sends: readonly DiagramSend[]): { label: string; title: string } {
  const newest = sends[0]!;
  const name = newest.diagram.title || 'Untitled diagram';
  const more = sends.length - 1;
  return {
    label: name,
    title: `${name}${more > 0 ? `, and ${more} more diagram${more === 1 ? '' : 's'}` : ''}. Opens in livediagram.`,
  };
}

export function diagramChipDom(sends: readonly DiagramSend[]): HTMLButtonElement {
  const newest = sends[0]!;
  const { label, title } = diagramChipWords(sends);
  const more = sends.length - 1;
  const button = document.createElement('button');
  button.type = 'button';
  button.contentEditable = 'false';
  button.dataset.diagramChip = '';
  button.className = `${CHIP} ${CHIP_OPEN}`;
  button.setAttribute('aria-label', `Open the diagram “${label}” in livediagram`);
  button.title = title;
  button.appendChild(brandMarkDom('livediagram', 12));
  const words = document.createElement('span');
  words.className = 'truncate';
  words.textContent = label;
  button.appendChild(words);
  if (more > 0) {
    const extra = document.createElement('span');
    extra.className = 'tabular-nums opacity-70';
    extra.textContent = `+${more}`;
    button.appendChild(extra);
  }
  // A press never moves the caret or starts a selection in the writing.
  button.addEventListener('mousedown', (e) => e.preventDefault());
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSentDiagram(newest);
  });
  return button;
}
