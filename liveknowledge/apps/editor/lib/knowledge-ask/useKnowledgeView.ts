'use client';

import { useSyncExternalStore } from 'react';
import { currentKnowledgeView, subscribeKnowledgeView, type KnowledgeView } from './knowledge-view';

const serverView = (): KnowledgeView => 'pages';

/** The view the address names, re-rendering when it changes. */
export function useKnowledgeView(): KnowledgeView {
  return useSyncExternalStore(subscribeKnowledgeView, currentKnowledgeView, serverView);
}
