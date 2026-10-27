'use client';

// The card threads' context value (CardThreadsContext.tsx), made once per change of what it holds, so the open card
// panel re-renders when its threads change and nothing else does.

import { useMemo } from 'react';
import type { CardThreads } from '@/hooks/plan/useCardThreads';
import type { CardThreadsContextValue, ThreadPlanChoice } from './CardThreadsContext';

export function useCardThreadsValue(input: {
  threads: CardThreads;
  projectId: string | null;
  projectName: string;
  ownerId: string;
  self: { name: string; color: string } | null;
  canComment: boolean;
  isEditor: boolean;
  offline: boolean;
  projectList: readonly ThreadPlanChoice[];
  openCard: (itemId: string) => void;
  announce: (message: string) => void;
}): CardThreadsContextValue | undefined {
  const {
    threads,
    projectId,
    projectName,
    ownerId,
    self,
    canComment,
    isEditor,
    offline,
    projectList,
    openCard,
    announce,
  } = input;
  return useMemo(
    () =>
      projectId
        ? {
            threads,
            projectId,
            projectName,
            selfId: ownerId,
            ownerId,
            self,
            canComment,
            isEditor,
            offline,
            // A thread is shared only into cloud plans; This Browser plans are listed by the offline store.
            otherPlans: offline ? [] : projectList.filter((p) => p.id !== projectId),
            openCard,
            announce,
          }
        : undefined,
    [
      threads,
      projectId,
      projectName,
      ownerId,
      self,
      canComment,
      isEditor,
      offline,
      projectList,
      openCard,
      announce,
    ],
  );
}
