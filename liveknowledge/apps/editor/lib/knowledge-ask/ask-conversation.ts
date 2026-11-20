// One Ask conversation, held outside React (docs/specs/030-knowledgebase/blueprints/ask-ui.md "The conversation").
// The turn list changes when a question is asked and when its answer ends; it does not change while an answer
// streams. The stream's pieces are gathered and handed to whoever draws the answer once a frame at most
// (`watchStream`), so a token is one string append and never a render of the conversation.
import type { AskNotUsed, AskRequest, AskSource, AskTurn } from '@liveknowledge/api-schema';
import { ASK_MAX_QUESTION_CHARS, ASK_MAX_TURNS } from '@liveknowledge/knowledge';
import type { AskOutcome } from '@/lib/api/knowledge-ask';

export type AskFeedback = 'helpful' | 'not-helpful';

export type AskTurnView = {
  id: string;
  question: string;
  /** `streaming` until the answer ends: `done`, `stopped` by the person, or `failed`. */
  status: 'streaming' | 'done' | 'stopped' | 'failed';
  /** The answer once it has ended (what had arrived, for one stopped); empty while it streams. */
  text: string;
  sources: AskSource[];
  notUsed: AskNotUsed[];
  gaps: string[];
  model: string;
  /** Why it failed: the stream's `error` kind, the route's refusal, or `network`. */
  failure?: string;
  feedback?: AskFeedback;
};

export type AskSend = (
  request: AskRequest,
  opts: { onDelta: (text: string) => void; signal: AbortSignal },
) => Promise<AskOutcome>;

export type AskConversation = {
  subscribe: (listener: () => void) => () => void;
  getTurns: () => readonly AskTurnView[];
  /** Whether an answer is on its way. */
  isStreaming: () => boolean;
  /** The conversation has its ten turns: the next question starts a new one. */
  isFull: () => boolean;
  /** Ask; false when it was not sent (nothing typed, too long, an answer on its way, or the conversation full). */
  ask: (question: string) => boolean;
  /** Ask a failed turn's question again, in its place. */
  askAgain: (turnId: string) => void;
  /** Stop the answer on its way; what arrived is kept. */
  stop: () => void;
  /** A new question: stops any answer and forgets the turns. */
  reset: () => void;
  setFeedback: (turnId: string, feedback: AskFeedback | undefined) => void;
  /** Draw a streaming turn: `onText` is handed what has arrived so far at once, then each frame's new text. */
  watchStream: (turnId: string, onText: (text: string) => void) => () => void;
};

type Frame = { request: (run: () => void) => number; cancel: (id: number) => void };
const browserFrame: Frame = {
  request: (run) => requestAnimationFrame(run),
  cancel: (id) => cancelAnimationFrame(id),
};

const NOTHING: Pick<AskTurnView, 'text' | 'sources' | 'notUsed' | 'gaps' | 'model'> = {
  text: '',
  sources: [],
  notUsed: [],
  gaps: [],
  model: '',
};

export function createAskConversation(deps: {
  send: AskSend;
  frame?: Frame;
  newId?: () => string;
  /** Told when a question is sent (to remember it) and when a turn ends. */
  onAsked?: (question: string) => void;
  onEnded?: (turn: AskTurnView) => void;
}): AskConversation {
  const frame = deps.frame ?? browserFrame;
  const newId = deps.newId ?? (() => crypto.randomUUID());
  let turns: readonly AskTurnView[] = [];
  const listeners = new Set<() => void>();
  // The answer on its way: everything that arrived, how much of it has been handed to the watchers, and the frame
  // that will hand over the rest.
  let live: {
    id: string;
    arrived: string;
    shown: number;
    frameId: number | null;
    abort: AbortController;
    watchers: Set<(text: string) => void>;
  } | null = null;

  const setTurns = (next: readonly AskTurnView[]) => {
    turns = next;
    listeners.forEach((listener) => listener());
  };
  const patch = (id: string, change: Partial<AskTurnView>) =>
    setTurns(turns.map((turn) => (turn.id === id ? { ...turn, ...change } : turn)));

  const flush = () => {
    if (!live) return;
    live.frameId = null;
    const piece = live.arrived.slice(live.shown);
    live.shown = live.arrived.length;
    if (piece) live.watchers.forEach((watcher) => watcher(piece));
  };

  const endLive = (): string => {
    if (!live) return '';
    if (live.frameId !== null) frame.cancel(live.frameId);
    const { arrived } = live;
    live = null;
    return arrived;
  };

  const run = (id: string, question: string, earlier: readonly AskTurnView[]) => {
    const abort = new AbortController();
    live = { id, arrived: '', shown: 0, frameId: null, abort, watchers: new Set() };
    // What was answered before rides along, so a follow-up is read in its light; a failed turn says nothing.
    const sent: AskTurn[] = earlier
      .filter((turn) => turn.text && (turn.status === 'done' || turn.status === 'stopped'))
      .map((turn) => ({ question: turn.question, answer: turn.text }));
    deps.onAsked?.(question);
    deps
      .send(
        { question, ...(sent.length > 0 ? { turns: sent } : {}) },
        {
          signal: abort.signal,
          onDelta: (text) => {
            if (live?.id !== id) return;
            live.arrived += text;
            live.frameId ??= frame.request(flush);
          },
        },
      )
      .then((outcome) => {
        if (live?.id !== id) return;
        endLive();
        patch(
          id,
          outcome.type === 'done'
            ? {
                status: 'done',
                text: outcome.text,
                sources: outcome.sources,
                notUsed: outcome.notUsed,
                gaps: outcome.gaps,
                model: outcome.model,
              }
            : { status: 'failed', failure: outcome.kind },
        );
        const ended = turns.find((turn) => turn.id === id);
        if (ended) deps.onEnded?.(ended);
      })
      // Only an abort rejects, and `stop` and `reset` have already settled the turn.
      .catch(() => {});
  };

  const ask = (asked: string): boolean => {
    const question = asked.trim();
    if (!question || question.length > ASK_MAX_QUESTION_CHARS) return false;
    if (live || turns.length >= ASK_MAX_TURNS) return false;
    const id = newId();
    const earlier = turns;
    setTurns([...turns, { id, question, status: 'streaming', ...NOTHING }]);
    run(id, question, earlier);
    return true;
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getTurns: () => turns,
    isStreaming: () => live !== null,
    isFull: () => turns.length >= ASK_MAX_TURNS,
    ask,
    askAgain: (turnId) => {
      const at = turns.findIndex((turn) => turn.id === turnId);
      const turn = turns[at];
      if (!turn || turn.status !== 'failed' || live) return;
      const earlier = turns.slice(0, at);
      const { failure: _failure, ...rest } = turn;
      setTurns(turns.map((t) => (t.id === turnId ? { ...rest, status: 'streaming' } : t)));
      run(turnId, turn.question, earlier);
    },
    stop: () => {
      if (!live) return;
      const { id, abort } = live;
      const arrived = endLive();
      abort.abort();
      patch(id, { status: 'stopped', text: arrived });
    },
    reset: () => {
      live?.abort.abort();
      endLive();
      if (turns.length > 0) setTurns([]);
    },
    setFeedback: (turnId, feedback) => {
      const turn = turns.find((t) => t.id === turnId);
      if (!turn || turn.feedback === feedback) return;
      const { feedback: _was, ...rest } = turn;
      setTurns(turns.map((t) => (t.id === turnId ? (feedback ? { ...rest, feedback } : rest) : t)));
    },
    watchStream: (turnId, onText) => {
      if (live?.id !== turnId) return () => {};
      const at = live;
      // What earlier frames already handed over; the frame pending hands this watcher the rest with everyone.
      if (at.shown > 0) onText(at.arrived.slice(0, at.shown));
      at.watchers.add(onText);
      return () => at.watchers.delete(onText);
    },
  };
}
