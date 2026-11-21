// What Ask keeps for the browser session (docs/specs/030-knowledgebase/blueprints/ask-ui.md "The conversation"): one
// conversation per person and knowledgebase, so leaving the Ask view to read a cited page and coming back finds the
// answer where it was, still streaming if it was; and the person's chats, read from and written to `localStorage`
// (each with its turns, so a chat opens again after a reload; search-and-ask.md "The Ask view"). Nothing here is a
// server's.
import type { KnowledgeCaller } from '@/lib/api/knowledge';
import { apiAskKnowledge } from '@/lib/api/knowledge-ask';
import { track } from '@/lib/telemetry';
import { aiSettingsStore } from './ai-settings-store';
import { askAiChoiceStore } from './ask-ai-choice';
import { createAskConversation, type AskConversation, type AskTurnView } from './ask-conversation';
import {
  chatIdOf,
  readRecentQuestions,
  withChatChanged,
  withChatRemoved,
  withChatSaved,
  writeRecentQuestions,
  type RecentQuestion,
  type SavedTurn,
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
  /** Keep a chat's turns, at the head of the list (asked in now). Accepted stays accepted. */
  save(
    who: KnowledgeCaller,
    documentId: string,
    id: string,
    turns: readonly AskTurnView[],
    now = Date.now(),
  ): void {
    const first = turns[0];
    if (!first) return;
    const list = recentQuestionsStore.get(who, documentId);
    const was = list.find((row) => chatIdOf(row) === id);
    write(
      who,
      documentId,
      withChatSaved(list, {
        id,
        question: first.question,
        askedAt: now,
        turns: turns.map(savedTurn),
        ...(was?.completedAt === undefined ? {} : { completedAt: was.completedAt }),
      }),
    );
  },
  /** Accept Answer: the chat goes to Completed Questions. */
  accept(who: KnowledgeCaller, documentId: string, id: string, now = Date.now()): void {
    write(
      who,
      documentId,
      withChatChanged(recentQuestionsStore.get(who, documentId), id, (row) => ({
        ...row,
        completedAt: now,
      })),
    );
  },
  /** Reopen: back among the dated groups, asked in now. */
  reopen(who: KnowledgeCaller, documentId: string, id: string, now = Date.now()): void {
    const list = recentQuestionsStore.get(who, documentId);
    const row = list.find((r) => chatIdOf(r) === id);
    if (!row) return;
    const { completedAt: _done, ...rest } = row;
    write(who, documentId, withChatSaved(list, { ...rest, askedAt: now }));
  },
  /** Delete a chat from this browser. */
  remove(who: KnowledgeCaller, documentId: string, id: string): void {
    write(who, documentId, withChatRemoved(recentQuestionsStore.get(who, documentId), id));
  },
};

function write(who: KnowledgeCaller, documentId: string, next: readonly RecentQuestion[]) {
  recents.set(keyOf(who, documentId), next.length > 0 ? next : NO_QUESTIONS);
  writeRecentQuestions(storage(), who.ownerId, documentId, next);
  recentListeners.forEach((listener) => listener());
}

// A turn as a chat keeps it: one still streaming is kept as stopped, with nothing arrived (the stream is the tab's).
function savedTurn(turn: AskTurnView): SavedTurn {
  const { status, ...rest } = turn;
  return status === 'streaming' ? { ...rest, status: 'stopped', text: '' } : { ...rest, status };
}

/** A kept chat's turns, for the conversation to show. */
export const chatTurns = (row: RecentQuestion): AskTurnView[] => row.turns ?? [];

/** The conversation this person has with this knowledgebase, made on first ask and kept while the tab lives. */
export function askConversationFor(who: KnowledgeCaller, documentId: string): AskConversation {
  const key = keyOf(who, documentId);
  const held = conversations.get(key);
  if (held) return held;
  const conversation = createAskConversation({
    // The choice of AI in force when the question is asked: switching mid-chat applies to the next question.
    send: (request, opts) =>
      apiAskKnowledge(
        who,
        documentId,
        { ...request, ai: askAiChoiceStore.get(who, documentId) },
        opts,
      ),
    onAsked: () => {
      // The count of asks, never the words.
      track('UI', 'Used', 'AskQuestion');
      keep();
    },
    onEnded: (turn) => {
      keep();
      // The key went, or cannot be read: the view should say so, not offer the field.
      if (turn.failure === 'ask_unavailable') void aiSettingsStore.refresh(who, documentId);
    },
  });
  // The chat as it stands now, kept in this browser.
  function keep() {
    const id = conversation.chatId();
    if (id) recentQuestionsStore.save(who, documentId, id, conversation.getTurns());
  }
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
  askAiChoiceStore.reset();
}
