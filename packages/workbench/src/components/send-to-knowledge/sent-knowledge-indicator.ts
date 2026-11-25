// A sent element's knowledgebase chip on the canvas (liveworkspace/docs/specs/004-index/send-to-knowledge.md "The
// chips"): one of the element's own indicators, after Send to Plan's, liveknowledge's logo; its hover names the page
// and knowledgebase, and a press opens the page in a new browser tab.
import { createElement, type JSX } from 'react';
import { BrandMark } from '@liveworkspace/brand';
import { workbench } from '../../bindings';
import { openSentPage, sentPageWords, useKnowledgeSends } from './knowledge-send-store';

function KnowledgeLogoGlyph({ size = 12 }: { size?: number } = {}): JSX.Element {
  return createElement(BrandMark, {
    app: 'liveknowledge',
    className: 'shrink-0',
    style: { width: size, height: size },
  });
}

/** The glyph each app's ElementIndicators draws for the knowledge kind. */
export const SENT_KNOWLEDGE_GLYPHS = { knowledge: KnowledgeLogoGlyph } as const;

/** What an element's indicator needs: the page's title, where it is in words, and its opener. */
export type SentKnowledgeIndicator = { onOpen: () => void; title: string; where: string };

/** The element's knowledgebase indicator, or undefined when nothing was sent from it; live. */
export function useSentKnowledgeIndicator(elementId: string): SentKnowledgeIndicator | undefined {
  const sends = useKnowledgeSends(elementId);
  const newest = sends[0];
  if (!newest) return undefined;
  const more = sends.length - 1;
  return {
    onOpen: () => {
      workbench.track('UI', 'Opened', 'SentKnowledge');
      openSentPage(newest);
    },
    title: newest.page.title || 'Untitled page',
    where: `${sentPageWords(newest)}${more > 0 ? ` +${more}` : ''}`,
  };
}
