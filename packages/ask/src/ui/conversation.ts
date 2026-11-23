// One item's conversation with Ask AI (liveworkspace/docs/specs/019-ask/ask.md "The conversation"): its turns, the
// answer streaming into the last one, and the calls that make them. Kept in the page's memory per item while the
// page is open (closing Tools and opening it again finds the thread), never stored: a reload starts afresh. No React
// here: the tool reads it through `subscribe` and `turns`.
import type { AiKeyFailure } from '@liveworkspace/ai/key-failure';
import { ASK_MAX_QUESTION_CHARS, ASK_MAX_TURNS } from '../limits';
import { choosePassages, type AskPassage } from '../passages';
import type { AskTurn } from '../request';
import type { AskProvider, AskSource } from '../wire';
import { ASK_FAILED, type AskSend } from './ask-client';

export type AskTurnView = {
  id: string;
  question: string;
  status: 'streaming' | 'done' | 'failed' | 'stopped';
  /** The answer so far, with its citation markers. */
  text: string;
  sources: readonly AskSource[];
  /** Which AI answered, once it has. */
  provider?: AskProvider;
  model?: string;
  failure?: { kind: string; message: string; aiKey?: AiKeyFailure };
};

/** What the conversation asks its host for, read at each question (the newest the tool handed it). */
export type AskConversationDeps = {
  send: AskSend;
  passages: () => readonly AskPassage[] | Promise<readonly AskPassage[]>;
  teamId: () => string | null;
  /** The person chose built-in AI over the key that applies. */
  builtIn: () => boolean;
  /** What a question says when the item holds no words. */
  nothingToRead: string;
};

/** Runs `paint` before the next frame: a stream's pieces reach the page once a frame at most. */
export type Frame = (paint: () => void) => void;
const nextFrame: Frame = (paint) => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(paint);
  else setTimeout(paint, 16);
};

let made = 0;

export class AskConversation {
  private list: readonly AskTurnView[] = [];
  private readonly listeners = new Set<() => void>();
  private abort: AbortController | null = null;
  private painting = false;
  private deps: AskConversationDeps | null = null;
  private readonly frame: Frame;

  constructor(frame: Frame = nextFrame) {
    this.frame = frame;
  }

  /** The newest host: the tool hands it on each render, so a question reads what is true when it is asked. */
  bind(deps: AskConversationDeps): void {
    this.deps = deps;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** The turns, oldest first. The same array until something changes. */
  turns = (): readonly AskTurnView[] => this.list;

  get streaming(): boolean {
    return this.abort !== null;
  }

  /** The key failure the newest turn ended on, for the AI pill; null once a later turn answers. */
  keyFailure(): AiKeyFailure | null {
    return this.list[this.list.length - 1]?.failure?.aiKey ?? null;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private change(id: string, next: Partial<AskTurnView>): void {
    this.list = this.list.map((turn) => (turn.id === id ? { ...turn, ...next } : turn));
  }

  /** Asks `question`. False when it was not taken (empty, too long, or an answer is still streaming): the field
   *  then keeps what was typed. */
  ask(question: string): boolean {
    const asked = question.trim();
    if (!asked || asked.length > ASK_MAX_QUESTION_CHARS || this.streaming || !this.deps)
      return false;
    const id = `turn-${++made}`;
    // The turns a later question is answered with: the finished ones, oldest first.
    const earlier = this.list.filter((turn) => turn.status === 'done' && turn.text !== '');
    // A conversation keeps its newest turns: the oldest leaves as a new one joins.
    this.list = [
      ...this.list.slice(-(ASK_MAX_TURNS - 1)),
      { id, question: asked, status: 'streaming', text: '', sources: [] },
    ];
    const abort = new AbortController();
    this.abort = abort;
    this.emit();
    void this.run(id, asked, earlier, abort, this.deps);
    return true;
  }

  private async run(
    id: string,
    question: string,
    earlier: readonly AskTurnView[],
    abort: AbortController,
    deps: AskConversationDeps,
  ): Promise<void> {
    let text = '';
    const end = (next: Partial<AskTurnView>) => {
      if (this.abort === abort) this.abort = null;
      this.change(id, next);
      this.emit();
    };
    try {
      const all = await deps.passages();
      if (abort.signal.aborted) return end({ status: 'stopped' });
      const passages = choosePassages(
        question,
        all,
        earlier.map((turn) => turn.question),
      ).map((numbered) => numbered.passage);
      if (passages.length === 0)
        return end({
          status: 'failed',
          failure: { kind: 'ask_nothing_to_read', message: deps.nothingToRead },
        });
      const turns: AskTurn[] = earlier.map((turn) => ({
        question: turn.question,
        answer: turn.text,
      }));
      const teamId = deps.teamId();
      const outcome = await deps.send(
        {
          question,
          passages,
          ...(turns.length ? { turns } : {}),
          ...(teamId ? { teamId } : {}),
          ...(deps.builtIn() ? { ai: 'built-in' as const } : {}),
        },
        {
          signal: abort.signal,
          onDelta: (piece) => {
            text += piece;
            if (this.painting) return;
            this.painting = true;
            this.frame(() => {
              this.painting = false;
              // A frame that lands after the answer ended has nothing to add.
              if (this.abort !== abort) return;
              this.change(id, { text });
              this.emit();
            });
          },
        },
      );
      if (outcome.type === 'done')
        return end({
          status: 'done',
          text: outcome.text,
          sources: outcome.sources,
          provider: outcome.provider,
          model: outcome.model,
        });
      end({
        status: 'failed',
        text,
        failure: {
          kind: outcome.kind,
          message: outcome.message,
          ...(outcome.aiKey ? { aiKey: outcome.aiKey } : {}),
        },
      });
    } catch {
      // Stopped by the person: what had arrived is kept. Anything else is a failure said in fixed words.
      if (abort.signal.aborted) end({ status: 'stopped', text });
      else end({ status: 'failed', text, failure: { kind: 'other', message: ASK_FAILED } });
    }
  }

  /** Stops the answer that is streaming; what had arrived is kept. */
  stop(): void {
    this.abort?.abort();
  }

  /** A failed or stopped turn asked again: it leaves, and its question is asked afresh. */
  askAgain(id: string): boolean {
    const turn = this.list.find((t) => t.id === id);
    if (!turn || this.streaming) return false;
    this.list = this.list.filter((t) => t.id !== id);
    return this.ask(turn.question);
  }

  /** New Chat: the turns go, and an answer still streaming is stopped. */
  clear(): void {
    this.abort?.abort();
    this.abort = null;
    this.list = [];
    this.emit();
  }
}

// One conversation per open item, for as long as the page is: the few most recent are kept.
const KEPT = 6;
const conversations = new Map<string, AskConversation>();

/** The conversation of `itemId`, made on first ask. */
export function conversationOf(itemId: string): AskConversation {
  let conversation = conversations.get(itemId);
  if (conversation) {
    // Most recently used last.
    conversations.delete(itemId);
  } else {
    conversation = new AskConversation();
    for (const oldest of conversations.keys()) {
      if (conversations.size < KEPT) break;
      conversations.get(oldest)?.clear();
      conversations.delete(oldest);
    }
  }
  conversations.set(itemId, conversation);
  return conversation;
}

/** Forget every conversation (tests). */
export function resetConversations(): void {
  for (const conversation of conversations.values()) conversation.clear();
  conversations.clear();
}
