import {
  isLivePollShape,
  pollSupersedes,
  sanitisePoll,
  sanitisePollAnswer,
  sha256Hex,
  type LivePoll,
  type RoomOp,
} from '@livediagram/api-schema';
import { GUEST_VOTERS_PER_NETWORK } from './vote-integrity';

// The poll that is running in a room, and everyone's answer to it (docs/specs/012-collaboration/collab-race-hardening.md).
// A poll is not document state (docs/specs/012-collaboration/live-poll.md), but it has to outlive a socket: a
// late joiner or a refresh used to see no poll at all, and a host who
// refreshed could no longer end it. The room feeds it the ops that start, end
// and answer a poll, and replays it to each session on hello.
//
// Who an answer belongs to is decided here, never taken from the sender as given
// (docs/specs/012-collaboration/vote-integrity.md): an account answers once per poll, any other session answers under
// a key it proves with a per-browser secret, and one network's non-account answers are capped.

const LIVE_POLL_KEY = 'live-poll';
// Answers held per poll. Far above any real room; a flood gate, not a quota.
const POLL_ANSWERS_MAX = 1000;
const ANSWER_KEY_MAX = 200;
const PROOF_MAX = 200;
// Stored digests and tags are cut to 32 hex characters (128 bits): plenty to tell them apart, half the storage.
const TAG_LEN = 32;

// What `claims[key]` holds: who may answer under that key again.
//   - `h:<sha256 of the proof>`: the browser holding that secret.
//   - `a:<person tag>`: any session of that verified account.
//   - `s`: the key is a session's own presence id, which only that session can present.
type Claim = string;

export type LivePollState = {
  poll: LivePoll;
  answers: Record<string, string | null>;
  // Absent on a state stored before answers were claimed; read as empty.
  claims?: Record<string, Claim>;
  // An account's one answer key for this poll, by person tag.
  accountKeys?: Record<string, string>;
  // Non-account answer keys per network tag.
  networks?: Record<string, number>;
};

// The parts of a session the poll needs. All of it is server-held: the presence id is minted by the room, and the
// person and network tags are stamped by the api worker on the upgrade.
export type PollAnswerer = {
  presenceId: string;
  personTag: string | null;
  networkTag: string | null;
  // The key this session already answered this poll under, and the way to record it. Read and written inside the
  // same synchronous stretch as the checks, so two answers from one socket cannot both pass as its first.
  answeredAs(): { pollId: string; key: string } | null;
  rememberAnswer(answeredAs: { pollId: string; key: string }): void;
};

export type PollAnswerRefusal = 'claimed' | 'session_key' | 'network_cap' | 'answers_cap';

export type PollAnswerOutcome =
  | { accepted: true; op: RoomOp }
  | { accepted: false; reason: PollAnswerRefusal | 'no_poll' | 'bad_value' };

type PollStorage = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
};

function claimOk(existing: Claim | undefined, claim: Claim): boolean {
  return existing === undefined || existing === claim;
}

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
      this.state = { poll, answers: {}, claims: {}, accountKeys: {}, networks: {} };
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

  // One answer. Returns the op to relay, under the key the room decided, or why it was refused; a refused answer
  // reaches nobody's tally. The proof is hashed before anything is read, so everything after the one await runs
  // without interleaving another answer.
  async noteAnswer(op: unknown, who: PollAnswerer): Promise<PollAnswerOutcome> {
    const a = op as { pollId?: unknown; value?: unknown; key?: unknown; proof?: unknown };
    if (a.value !== null && typeof a.value !== 'string')
      return { accepted: false, reason: 'bad_value' };
    const claimedKey =
      typeof a.key === 'string' && a.key.length > 0 && a.key.length <= ANSWER_KEY_MAX
        ? a.key
        : null;
    const proof =
      typeof a.proof === 'string' && a.proof.length > 0 && a.proof.length <= PROOF_MAX
        ? a.proof
        : null;
    const proofClaim =
      proof && claimedKey
        ? `h:${(await sha256Hex(new TextEncoder().encode(`livediagram:poll-proof:v1:${proof}`))).slice(0, TAG_LEN)}`
        : null;

    const current = this.state;
    if (!current || current.poll.id !== a.pollId) return { accepted: false, reason: 'no_poll' };
    const claims = (current.claims ??= {});
    const accountKeys = (current.accountKeys ??= {});
    const networks = (current.networks ??= {});

    const ownKey = { key: who.presenceId, claim: 's' as Claim };
    const personTag = who.personTag?.slice(0, TAG_LEN) ?? null;
    let chosen: { key: string; claim: Claim };
    if (personTag) {
      // One answer per account per poll: its first key stays its key, from any of its sessions.
      const accountClaim = `a:${personTag}`;
      const established = accountKeys[personTag];
      if (established) chosen = { key: established, claim: accountClaim };
      else {
        const candidate = claimedKey ?? who.presenceId;
        // A key somebody else holds is not the account's to take; it answers under its own presence id instead,
        // still as the account, so its other sessions find it.
        chosen = claimOk(claims[candidate], accountClaim)
          ? { key: candidate, claim: accountClaim }
          : { key: who.presenceId, claim: accountClaim };
      }
    } else if (claimedKey && proofClaim) {
      // The browser holding the secret, and nobody else. A key somebody else already holds falls back to the
      // session's own presence id: the answer still counts, and the other person's stays theirs.
      chosen = claimOk(claims[claimedKey], proofClaim)
        ? { key: claimedKey, claim: proofClaim }
        : ownKey;
    } else {
      // An old client with no proof: its own presence id, which only it can present.
      chosen = ownKey;
    }
    // A session's own presence id is always its own: the room minted it for that socket alone, so whatever claim
    // somebody else put on it gives way. Every other key needs a matching claim.
    if (chosen.key !== who.presenceId && !claimOk(claims[chosen.key], chosen.claim)) {
      return { accepted: false, reason: 'claimed' };
    }

    // One key per session per poll: a socket cannot become a second person.
    const answeredAs = who.answeredAs();
    if (answeredAs && answeredAs.pollId === current.poll.id && answeredAs.key !== chosen.key) {
      // An account's sessions all answer under its one key, so this only refuses a non-account session.
      return { accepted: false, reason: 'session_key' };
    }

    const isNew = !(chosen.key in current.answers);
    const network = personTag ? null : (who.networkTag?.slice(0, TAG_LEN) ?? 'unknown');
    if (isNew) {
      if (this.answerCount >= POLL_ANSWERS_MAX) return { accepted: false, reason: 'answers_cap' };
      if (network && (networks[network] ?? 0) >= GUEST_VOTERS_PER_NETWORK) {
        return { accepted: false, reason: 'network_cap' };
      }
    }

    const value = sanitisePollAnswer(current.poll, a.value);
    current.answers[chosen.key] = value;
    claims[chosen.key] = chosen.claim;
    if (personTag && !accountKeys[personTag]) accountKeys[personTag] = chosen.key;
    if (isNew) {
      this.answerCount++;
      if (network) networks[network] = (networks[network] ?? 0) + 1;
    }
    if (answeredAs?.pollId !== current.poll.id || answeredAs.key !== chosen.key) {
      who.rememberAnswer({ pollId: current.poll.id, key: chosen.key });
    }
    void this.storage.put(LIVE_POLL_KEY, current);
    return {
      accepted: true,
      op: { kind: 'poll-answer', pollId: current.poll.id, value, key: chosen.key },
    };
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
