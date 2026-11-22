'use client';

import { useSyncExternalStore } from 'react';
import {
  currentKnowledgeView,
  knowledgeViewHref,
  subscribeKnowledgeView,
  type KnowledgeView,
} from './knowledge-view';

const serverView = (): KnowledgeView => 'pages';

/** The view the address names, re-rendering when it changes. */
export function useKnowledgeView(): KnowledgeView {
  return useSyncExternalStore(subscribeKnowledgeView, currentKnowledgeView, serverView);
}

const address = () => `${window.location.pathname}${window.location.search}`;
const serverAddress = () => '';

/** Each view's address for a link: this address with its `view`, at the open page (`#t=<id>`). Built from the
 *  page's id, not the hash on show, which the editor writes a moment after the page opens. */
export function useKnowledgeViewHref(activePageId: string | null): (view: KnowledgeView) => string {
  const here = useSyncExternalStore(subscribeKnowledgeView, address, serverAddress);
  const hash = activePageId ? `#t=${encodeURIComponent(activePageId)}` : '';
  return (view) => (here ? knowledgeViewHref(`${here}${hash}`, view) : '#');
}
