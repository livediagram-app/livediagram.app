// Your own raised hand in a call (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand"; blueprint
// "Behaviour and state (part 3)"): up or down, the room you raised it in, and who let it speak. The call owns one and
// tells it what happens; it says what to send. Presence only: nothing here is stored.
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import type { CallStaging } from './stage';
import type { HandState, StagePlace } from './calls-store';

/** What a hand sends over the room: the editor adds the tab. */
export type HandSignal = { kind: 'avatar-hand'; raised: boolean; letSpeak?: string | null };

type Hand = { zone: string | null; letSpeak: string | null };

export class RaisedHand {
  private hand: Hand | null = null;
  private readonly send: (signal: HandSignal) => void;

  constructor(send: (signal: HandSignal) => void) {
    this.send = send;
  }

  /** Down, raised, or let speak (`letSpeakOk`: whoever let you speak still may). */
  state(letSpeakOk: boolean): HandState {
    if (!this.hand) return 'down';
    return this.hand.letSpeak !== null && letSpeakOk ? 'speaking' : 'raised';
  }

  /** Who let your hand speak, or null. */
  get letSpeakBy(): string | null {
    return this.hand?.letSpeak ?? null;
  }

  get up(): boolean {
    return this.hand !== null;
  }

  /** Raise it in `zone` (the room you stand in). False when it was already up. */
  raise(zone: string | null): boolean {
    if (this.hand) return false;
    this.hand = { zone, letSpeak: null };
    debugLog('[calls] hand', 'raised');
    this.send({ kind: 'avatar-hand', raised: true });
    return true;
  }

  /** Lower it (Lower Hand, Done, walking out, leaving). */
  lower(): void {
    if (!this.hand) return;
    this.hand = null;
    debugLog('[calls] hand', 'lowered');
    this.send({ kind: 'avatar-hand', raised: false });
  }

  /**
   * Someone let your hand speak (`on`) or pressed Done. `may` says whether they may (an Editor, or speaking from a
   * stage); otherwise, or with no hand up, it is ignored.
   */
  letSpeak(from: string, on: boolean, may: boolean): void {
    if (!this.hand || !may) {
      debugLog('[calls] let speak ignored', this.hand ? 'not allowed' : 'no hand');
      return;
    }
    if (!on) {
      this.lower();
      return;
    }
    if (this.hand.letSpeak === from) return;
    this.hand = { ...this.hand, letSpeak: from };
    this.send({ kind: 'avatar-hand', raised: true, letSpeak: from });
  }

  /** You walked into another room (or out of one): the hand goes down. */
  keepIn(zone: string | null): void {
    if (this.hand && this.hand.zone !== zone) this.lower();
  }

  /** A walker arrived: tell them the hand is up. */
  resend(): void {
    if (!this.hand) return;
    this.send({ kind: 'avatar-hand', raised: true, letSpeak: this.hand.letSpeak });
  }
}

/**
 * Where you stand towards a stage, for the call strip: speaking from one, the audience of a live one (you may raise a
 * hand), on one that bars you with nobody speaking, or none of these.
 */
export function stagePlace(stage: CallStaging | undefined, barred: boolean): StagePlace {
  if (stage?.self) return 'speaker';
  if (stage) return 'audience';
  return barred ? 'barred' : 'none';
}
