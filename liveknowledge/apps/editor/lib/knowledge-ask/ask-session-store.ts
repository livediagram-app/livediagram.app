// What Ask keeps for the browser session (docs/specs/030-knowledgebase/blueprints/ask-ui.md "The conversation"): one
// conversation per person and knowledgebase, so leaving the Ask view to read a cited page and coming back finds the
// answer where it was, still streaming if it was; and the person's recent questions, read from and written to
// `localStorage`. Nothing here is a server's: a reload starts a new conversation.
import type { KnowledgeCaller } from '@/lib/api/knowledge';
import { apiAskKnowledge } from '@/lib/api/knowledge-ask';
import { track } from '@/lib/telemetry';
import { aiSettingsStore } from './ai-settings-store';
import { createAskConversation, type AskConversation } from './ask-conversation';
import {
  readRecentQuestions,
  withQuestionRemembered,
  writeRecentQuestions,
  type RecentQuestion,
} from './recent-questions';

/** Conversations kept at once; the one opened longest ago goes first. */
const KEPT_CONVERSATIONS = 4;

const conversations = new Map<string, AskConversation>();
const recents = new Map<string, readonly RecentQuestion[]>();
const recentListeners = new Set<() => void>();
const NO_QUESTIONS: readonly RecentQuestion[] = [];

const keyOf = (who: KnowledgeCaller, documentId: string) => `${who.ownerId}:${documentId}`;
const storage = () => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export const recentQuestionsStore = {
  subscribe: (listener: () => void): (() => void) => {
    recentListeners.add(listener);
    return () => recentListeners.delete(listener);
  },
  get(who: KnowledgeCaller, documentId: string): readonly RecentQuestion[] {
    const key = keyOf(who, documentId);
    let list = recents.get(key);
    if (!list) {
      const read = readRecentQuestions(storage(), who.ownerId, documentId);
      list = read.length > 0 ? read : NO_QUESTIONS;
      recents.set(key, list);
    }
    return list;
  },
  remember(who: KnowledgeCaller, documentId: string, question: string, now = Date.now()): void {
    const next = withQuestionRemembered(recentQuestionsStore.get(who, documentId), question, now);
    recents.set(keyOf(who, documentId), next);
    writeRecentQuestions(storage(), who.ownerId, documentId, next);
    recentListeners.forEach((listener) => listener());
  },
};

/** The conversation this person has with this knowledgebase, made on first ask and kept while the tab lives. */
export function askConversationFor(who: KnowledgeCaller, documentId: string): AskConversation {
  const key = keyOf(who, documentId);
  const held = conversations.get(key);
  if (held) return held;
  const conversation = createAskConversation({
    send: (request, opts) => apiAskKnowledge(who, documentId, request, opts),
    onAsked: (question) => {
      // The count of asks, never the words.
      track('UI', 'Used', 'AskQuestion');
      recentQuestionsStore.remember(who, documentId, question);
    },
    onEnded: (turn) => {
      // The key went, or cannot be read: the view should say so, not offer the field.
      if (turn.failure === 'ask_unavailable') void aiSettingsStore.refresh(who, documentId);
    },
  });
  conversations.set(key, conversation);
  if (conversations.size > KEPT_CONVERSATIONS) {
    const [oldest, gone] = conversations.entries().next().value!;
    gone.reset();
    conversations.delete(oldest);
  }
  return conversation;
}

/** Forget everything (tests). */
export function resetAskSession(): void {
  conversations.forEach((conversation) => conversation.reset());
  conversations.clear();
  recents.clear();
}
