import {
  isLivePollShape,
  pollSupersedes,
  sanitisePoll,
  sanitisePollAnswer,
  type LivePoll,
  type RoomOp,
} from '@livediagram/api-schema';

// The poll that is running in a room, and everyone's answer to it (spec/152).
// A poll is not document state (spec/88), but it has to outlive a socket: a
// late joiner or a refresh used to see no poll at all, and a host who
// refreshed could no longer end it. The room feeds it the ops that start, end
// and answer a poll, and replays it to each session on hello.

const LIVE_POLL_KEY = 'live-poll';
// Answers held per poll. Far above any real room; a flood gate, not a quota.
const POLL_ANSWERS_MAX = 1000;
const ANSWER_KEY_MAX = 200;

export type LivePollState = { poll: LivePoll; answers: Record<string, string | null> };

type PollStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
};

export class RoomLivePoll {
  state: LivePollState | null = null;
  // Keeps the answer count beside the map, rather than counting its keys per
  // answer.
  private answerCount = 0;
  private readonly storage: PollStorage;

  constructor(storage: PollStorage) {
    this.storage = storage;
  }

  async restore(): Promise<void> {
    this.state = (await this.storage.get<LivePollState>(LIVE_POLL_KEY)) ?? null;
    this.answerCount = this.state ? Object.keys(this.state.answers).length : 0;
  }

  // A poll-start or poll-end the room has sequenced. The same supersede rule
  // every client applies, so the room settles on the poll they do when two
  // are started at once.
  noteLifecycle(op: unknown): void {
    const o = op as { kind?: unknown; poll?: unknown; pollId?: unknown };
    if (o.kind === 'poll-start') {
      if (!isLivePollShape(o.poll)) return;
      const poll = sanitisePoll(o.poll);
      if (!poll || !pollSupersedes(poll, this.state?.poll ?? null)) return;
      this.state = { poll, answers: {} };
      this.answerCount = 0;
    } else if (o.kind === 'poll-end') {
      if (!this.state || this.state.poll.id !== o.pollId) return;
      this.state = null;
      this.answerCount = 0;
    } else {
      return;
    }
    void this.storage.put(LIVE_POLL_KEY, this.state);
  }

  // One answer, keyed by the answerer's collab key (the presence id, which
  // changes every reconnect, only for a client too old to send one).
  noteAnswer(op: unknown, presenceId: string): void {
    const a = op as { pollId?: unknown; value?: unknown; key?: unknown };
    const current = this.state;
    if (!current || current.poll.id !== a.pollId) return;
    if (a.value !== null && typeof a.value !== 'string') return;
    const key = typeof a.key === 'string' && a.key.length <= ANSWER_KEY_MAX ? a.key : presenceId;
    const isNew = !(key in current.answers);
    if (isNew && this.answerCount >= POLL_ANSWERS_MAX) return;
    current.answers[key] = sanitisePollAnswer(current.poll, a.value);
    if (isNew) this.answerCount++;
    void this.storage.put(LIVE_POLL_KEY, current);
  }

  // The frames a live peer would have seen: the poll, then every answer so
  // far. Clients treat a poll-start for the poll already on screen as a no-op,
  // so a session that was connected all along loses nothing.
  replayOps(): RoomOp[] {
    const current = this.state;
    if (!current) return [];
    return [
      { kind: 'poll-start', poll: current.poll },
      ...Object.entries(current.answers).map(([key, value]): RoomOp => ({
        kind: 'poll-answer',
        pollId: current.poll.id,
        value,
        key,
      })),
    ];
  }
}
