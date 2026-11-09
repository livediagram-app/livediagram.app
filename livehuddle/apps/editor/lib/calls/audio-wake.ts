// Waking the call's sound (docs/specs/012-collaboration/proximity-audio.md "Someone who arrives later"; blueprint
// "Waking the sound"). A browser may hold a page's sound back: a call joined by walking in before any press, or a
// context it suspended or interrupted later (Safari's `interrupted`). Nothing heard plays until the context runs
// again, so while it is held this tries `resume()` on every chance the browser may take: a voice arriving, the tab
// showing again or getting focus, and the next press or key anywhere. It says whether the sound is held, for the
// Call dock's Click to Hear. Event driven: nothing polls.

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;
const CAPTURE = { capture: true, passive: true } as const;

type Listenable = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

export type AudioWakeTargets = {
  // Where a press, a key, focus and pageshow are heard: the window.
  window?: Listenable | null;
  // Where visibilitychange is heard, and whether the page shows: the document.
  document?: (Listenable & { visibilityState?: DocumentVisibilityState }) | null;
};

/** Whether a context is held back: suspended, or interrupted (Safari). Closed and running are not. */
export function isHeld(context: Pick<AudioContext, 'state'>): boolean {
  const state = context.state as string | undefined;
  return state === 'suspended' || state === 'interrupted';
}

export class AudioWake {
  private readonly context: AudioContext;
  private readonly onHeld: (held: boolean) => void;
  private readonly win: Listenable | null;
  private readonly doc: AudioWakeTargets['document'];
  private held = false;
  private armed = false;
  private disposed = false;

  constructor(context: AudioContext, onHeld: (held: boolean) => void, targets?: AudioWakeTargets) {
    this.context = context;
    this.onHeld = onHeld;
    this.win = targets?.window ?? (typeof window === 'undefined' ? null : window);
    this.doc = targets?.document ?? (typeof document === 'undefined' ? null : document);
    // A stand-in context without events (tests, an old browser) is read once and never held.
    if (typeof context.addEventListener === 'function') {
      context.addEventListener('statechange', this.onState);
    }
    this.onState();
  }

  /** Try to start held sound now (a voice arrived, a press of Click to Hear); nothing while it runs. */
  nudge(): void {
    if (this.disposed || !isHeld(this.context)) return;
    void this.context.resume?.().catch(() => {});
  }

  /** The call ended: every listener goes, and nothing is reported again. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disarm();
    if (typeof this.context.removeEventListener === 'function') {
      this.context.removeEventListener('statechange', this.onState);
    }
  }

  private readonly onState = () => {
    if (this.disposed) return;
    const held = isHeld(this.context);
    if (held) this.arm();
    else this.disarm();
    if (held === this.held) return;
    this.held = held;
    this.onHeld(held);
  };

  private readonly onShow = () => {
    if (this.doc?.visibilityState !== 'hidden') this.nudge();
  };

  private readonly onChance = () => this.nudge();

  // Listening only while held: a running call adds nothing to any press.
  private arm(): void {
    if (this.armed) return;
    this.armed = true;
    for (const name of GESTURES) this.win?.addEventListener(name, this.onChance, CAPTURE);
    this.win?.addEventListener('focus', this.onChance);
    this.win?.addEventListener('pageshow', this.onChance);
    this.doc?.addEventListener('visibilitychange', this.onShow);
  }

  private disarm(): void {
    if (!this.armed) return;
    this.armed = false;
    for (const name of GESTURES) this.win?.removeEventListener(name, this.onChance, CAPTURE);
    this.win?.removeEventListener('focus', this.onChance);
    this.win?.removeEventListener('pageshow', this.onChance);
    this.doc?.removeEventListener('visibilitychange', this.onShow);
  }
}
